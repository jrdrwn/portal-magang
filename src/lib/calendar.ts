import "server-only";
import { db } from "./db";
import { addDays, dateToKey, todayDate } from "./dates";
import { getOfficeSetting } from "./queries";
import type { AttendanceStatus, HolidayKind } from "@/generated/prisma/enums";

export const WEEKDAYS = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 0, label: "Minggu" },
] as const;

export function parseWorkDays(value: string): Set<number> {
  return new Set(
    value
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
  );
}

export type Calendar = {
  workDays: Set<number>;
  holidays: Map<string, { name: string; kind: HolidayKind }>;
};

/** Hari kerja + libur dalam rentang (inklusif). */
export async function getCalendar(from: Date, to: Date): Promise<Calendar> {
  const [office, holidays] = await Promise.all([
    getOfficeSetting(),
    db.holiday.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, name: true, kind: true } }),
  ]);
  return {
    workDays: parseWorkDays(office.workDays),
    holidays: new Map(holidays.map((h) => [dateToKey(h.date), { name: h.name, kind: h.kind }])),
  };
}

export type DayKind = { type: "work" } | { type: "holiday"; name: string } | { type: "off" };

export function dayKind(date: Date, cal: Calendar): DayKind {
  const holiday = cal.holidays.get(dateToKey(date));
  if (holiday) return { type: "holiday", name: holiday.name };
  return cal.workDays.has(date.getUTCDay()) ? { type: "work" } : { type: "off" };
}

/** Status hari ini untuk absen; null = boleh absen. */
export async function nonWorkingReason(date: Date = todayDate()) {
  const cal = await getCalendar(date, date);
  const kind = dayKind(date, cal);
  if (kind.type === "holiday") return `Hari ini libur: ${kind.name}.`;
  if (kind.type === "off") return "Hari ini bukan hari kerja.";
  return null;
}

export type DayStatus = AttendanceStatus | "ABSENT" | "HOLIDAY" | "OFF" | "PENDING";

export type AttendanceSummary = Record<"present" | "late" | "permit" | "sick" | "absent" | "holiday" | "workdays", number>;

/**
 * Status per hari dalam periode [start, end] (dibatasi sampai hari ini).
 * ABSENT (alpa) = hari kerja yang sudah lewat, bukan libur, tanpa catatan apa pun.
 * Hari ini tanpa catatan = PENDING (belum absen), belum dihitung alpa.
 */
export function dailyStatuses(
  start: Date,
  end: Date,
  records: { date: Date; status: AttendanceStatus }[],
  cal: Calendar,
  today: Date = todayDate(),
) {
  const byDate = new Map(records.map((r) => [dateToKey(r.date), r.status]));
  const last = end < today ? end : today;
  const days: { date: Date; status: DayStatus; holidayName?: string }[] = [];
  for (let d = start; d <= last; d = addDays(d, 1)) {
    const recorded = byDate.get(dateToKey(d));
    const kind = dayKind(d, cal);
    if (recorded) days.push({ date: d, status: recorded });
    else if (kind.type === "holiday") days.push({ date: d, status: "HOLIDAY", holidayName: kind.name });
    else if (kind.type === "off") days.push({ date: d, status: "OFF" });
    else days.push({ date: d, status: dateToKey(d) === dateToKey(today) ? "PENDING" : "ABSENT" });
  }
  return days;
}

export function summarize(days: { status: DayStatus }[]): AttendanceSummary {
  const n = (s: DayStatus) => days.filter((d) => d.status === s).length;
  return {
    present: n("PRESENT"),
    late: n("LATE"),
    permit: n("PERMIT"),
    sick: n("SICK"),
    absent: n("ABSENT"),
    holiday: n("HOLIDAY"),
    workdays: days.filter((d) => d.status !== "HOLIDAY" && d.status !== "OFF").length,
  };
}

/** Ringkasan kehadiran satu pendaftaran (termasuk alpa). */
export async function registrationSummary(reg: { userId: string; startDate: Date; endDate: Date }) {
  const today = todayDate();
  const last = reg.endDate < today ? reg.endDate : today;
  if (reg.startDate > last) {
    return { days: [], summary: summarize([]) };
  }
  const [records, cal] = await Promise.all([
    db.attendance.findMany({
      where: { userId: reg.userId, date: { gte: reg.startDate, lte: last } },
      select: { date: true, status: true },
    }),
    getCalendar(reg.startDate, last),
  ]);
  const days = dailyStatuses(reg.startDate, last, records, cal, today);
  return { days, summary: summarize(days) };
}

export const dayStatusLabel: Record<"ABSENT" | "HOLIDAY" | "OFF" | "PENDING", string> = {
  ABSENT: "Alpa",
  HOLIDAY: "Libur",
  OFF: "Bukan hari kerja",
  PENDING: "Belum absen",
};

/**
 * Baris harian (terbaru dulu) untuk satu peserta di beberapa periode magang,
 * digabung dengan detail catatan absensi, plus ringkasan total.
 */
export async function attendanceDays(
  userId: string,
  regs: { startDate: Date; endDate: Date }[],
  limit = 120,
) {
  const today = todayDate();
  const ranges = regs
    .map((r) => ({ start: r.startDate, end: r.endDate < today ? r.endDate : today }))
    .filter((r) => r.start <= r.end);
  if (ranges.length === 0) return { rows: [], summary: summarize([]) };
  const from = ranges.reduce((m, r) => (r.start < m ? r.start : m), ranges[0].start);
  const to = ranges.reduce((m, r) => (r.end > m ? r.end : m), ranges[0].end);

  const [records, cal] = await Promise.all([
    db.attendance.findMany({
      where: { userId, date: { gte: from, lte: to } },
      include: { correctedBy: { select: { name: true } } },
    }),
    getCalendar(from, to),
  ]);
  const byKey = new Map(records.map((r) => [dateToKey(r.date), r]));
  const seen = new Set<string>();
  const days = ranges
    .flatMap((r) => dailyStatuses(r.start, r.end, records, cal, today))
    .filter((d) => (seen.has(dateToKey(d.date)) ? false : seen.add(dateToKey(d.date))))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    summary: summarize(days),
    rows: days.slice(0, limit).map((d) => ({ ...d, key: dateToKey(d.date), att: byKey.get(dateToKey(d.date)) ?? null })),
  };
}

/** Ringkasan kehadiran beberapa peserta pada rentang tanggal (dipotong ke periode magang masing-masing). */
export async function summariesFor(
  regs: { userId: string; startDate: Date; endDate: Date }[],
  from: Date,
  to: Date,
) {
  const result = new Map<string, AttendanceSummary>();
  if (regs.length === 0) return result;
  const [records, cal] = await Promise.all([
    db.attendance.findMany({
      where: { userId: { in: regs.map((r) => r.userId) }, date: { gte: from, lte: to } },
      select: { userId: true, date: true, status: true },
    }),
    getCalendar(from, to),
  ]);
  for (const r of regs) {
    const start = r.startDate > from ? r.startDate : from;
    const end = r.endDate < to ? r.endDate : to;
    const own = records.filter((x) => x.userId === r.userId);
    result.set(r.userId, summarize(start <= end ? dailyStatuses(start, end, own, cal) : []));
  }
  return result;
}
