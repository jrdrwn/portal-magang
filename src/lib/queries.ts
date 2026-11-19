import "server-only";
import { db } from "./db";
import { addDays, dateToKey, todayDate } from "./dates";

/** Pendaftaran yang disetujui dan mencakup tanggal `on` (default hari ini). */
export function getActiveRegistration(userId: string, on: Date = todayDate()) {
  return db.registration.findFirst({
    where: {
      userId,
      status: "APPROVED",
      startDate: { lte: on },
      endDate: { gte: on },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getOfficeSetting() {
  return db.officeSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export function getTodayAttendance(userId: string, today: Date = todayDate()) {
  return db.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
    include: { activities: { orderBy: { createdAt: "asc" } } },
  });
}

/** Ringkasan kehadiran per status untuk satu user dalam rentang tanggal. */
export async function getAttendanceSummary(
  userId: string,
  from: Date,
  to: Date,
) {
  const rows = await db.attendance.groupBy({
    by: ["status"],
    where: { userId, date: { gte: from, lte: to } },
    _count: { _all: true },
  });
  const count = (s: string) =>
    rows.find((r) => r.status === s)?._count._all ?? 0;
  return {
    present: count("PRESENT"),
    late: count("LATE"),
    permit: count("PERMIT"),
    sick: count("SICK"),
  };
}

/** Jumlah hari kerja (Sen-Jum) dalam rentang, inklusif. */
export function countWeekdays(from: Date, to: Date) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

export function weekdayKeys(from: Date, to: Date) {
  const keys: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) keys.push(dateToKey(d));
  }
  return keys;
}

/** Peserta aktif (akun aktif + pendaftaran disetujui yang mencakup tanggal `on`). */
export async function getActiveInterns(on: Date) {
  const regs = await db.registration.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: on },
      endDate: { gte: on },
      user: { isActive: true, role: "INTERN" },
    },
    select: {
      division: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  const seen = new Set<string>();
  return regs
    .filter((r) => (seen.has(r.user.id) ? false : seen.add(r.user.id)))
    .map((r) => ({ ...r.user, division: r.division }));
}
