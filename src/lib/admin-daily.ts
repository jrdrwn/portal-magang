import "server-only";
import { teamScope, type CurrentUser } from "./auth";
import { nonWorkingReason } from "./calendar";
import { db } from "./db";
import { dateKey, minutesOfDay, parseClock, todayDate } from "./dates";
import { formatMonth, monthEnd, monthStart, shiftMonth } from "./evaluation";
import { getActiveInterns, getOfficeSetting } from "./queries";
import type { NextStep, StripStep } from "./steps";

export type AdminPlan = {
  steps: StripStep[];
  next: NextStep | null;
  counts: { pending: number; notYet: number; noActivity: number; unevaluated: number };
  /** Bulan evaluasi yang sedang diingatkan (YYYY-MM), bila ada. */
  evalMonth: string | null;
  closed: string | null;
};

/**
 * Bulan evaluasi yang perlu diingatkan: bulan berjalan mulai tanggal 25,
 * atau bulan lalu pada tanggal 1–5.
 */
export function evaluationMonth(now: Date = new Date()): string | null {
  const key = dateKey(now);
  const day = Number(key.slice(8, 10));
  const month = key.slice(0, 7);
  if (day >= 25) return month;
  if (day <= 5) return shiftMonth(month, -1);
  return null;
}

/** Langkah harian admin, dihitung dari data tim admin (admin utama: semua tim). */
export async function getAdminPlan(admin: CurrentUser, now: Date = new Date()): Promise<AdminPlan> {
  const scope = teamScope(admin);
  const today = todayDate(now);
  const [office, closed, interns, pending] = await Promise.all([
    getOfficeSetting(),
    nonWorkingReason(today),
    getActiveInterns(today, scope),
    db.registration.count({ where: { status: "PENDING", ...(scope ? { teamId: scope } : {}) } }),
  ]);
  const ids = interns.map((i) => i.id);
  const records = ids.length
    ? await db.attendance.findMany({
        where: { date: today, userId: { in: ids } },
        select: { userId: true, status: true, checkInAt: true, _count: { select: { activities: { where: { type: "WORK" } } } } },
      })
    : [];

  const nowMin = minutesOfDay(now);
  const lateAfter = parseClock(office.lateAfter);
  const workEnd = parseClock(office.workEnd);
  const recorded = new Set(records.map((r) => r.userId));
  const notYet = closed ? 0 : ids.filter((id) => !recorded.has(id)).length;
  const noActivity = records.filter((r) => r.checkInAt && r._count.activities === 0).length;

  const evalMonth = evaluationMonth(now);
  let unevaluated = 0;
  if (evalMonth) {
    const start = monthStart(evalMonth);
    unevaluated = await db.registration.count({
      where: {
        status: "APPROVED",
        startDate: { lte: monthEnd(evalMonth) < today ? monthEnd(evalMonth) : today },
        endDate: { gte: start },
        ...(scope ? { teamId: scope } : {}),
        user: { isActive: true },
        evaluations: { none: { month: start } },
      },
    });
  }

  const steps: StripStep[] = [
    pending > 0
      ? { key: "pendaftaran", label: "Tinjau pendaftaran", state: "current", detail: `${pending} menunggu` }
      : { key: "pendaftaran", label: "Tinjau pendaftaran", state: "done", detail: "tidak ada antrean" },
  ];
  if (closed) {
    steps.push({ key: "kehadiran", label: "Cek kehadiran", state: "done", detail: "hari libur" });
  } else if (nowMin <= lateAfter) {
    steps.push({ key: "kehadiran", label: "Cek kehadiran", state: notYet === 0 && ids.length > 0 ? "done" : "upcoming", detail: notYet === 0 && ids.length > 0 ? "semua sudah absen" : `setelah ${office.lateAfter}` });
  } else {
    steps.push(
      notYet > 0
        ? { key: "kehadiran", label: "Cek kehadiran", state: "late", detail: `${notYet} belum absen` }
        : { key: "kehadiran", label: "Cek kehadiran", state: "done", detail: ids.length ? "semua tercatat" : "tidak ada peserta aktif" },
    );
  }
  if (closed) {
    steps.push({ key: "aktivitas", label: "Periksa aktivitas", state: "done", detail: "hari libur" });
  } else if (nowMin < workEnd) {
    steps.push({ key: "aktivitas", label: "Periksa aktivitas", state: "upcoming", detail: `setelah ${office.workEnd}` });
  } else {
    steps.push(
      noActivity > 0
        ? { key: "aktivitas", label: "Periksa aktivitas", state: "current", detail: `${noActivity} belum mencatat` }
        : { key: "aktivitas", label: "Periksa aktivitas", state: "done", detail: "semua sudah mencatat" },
    );
  }
  if (evalMonth && unevaluated > 0) {
    steps.push({ key: "evaluasi", label: `Evaluasi ${formatMonth(evalMonth)}`, state: "current", detail: `${unevaluated} belum dinilai` });
  }

  let next: NextStep | null = null;
  if (pending > 0) {
    next = { label: "Tinjau pendaftaran", href: "/admin/pendaftaran", hint: `${pending} pendaftaran menunggu persetujuan` };
  } else if (!closed && nowMin > lateAfter && notYet > 0) {
    next = { label: "Cek kehadiran", href: "/admin/absensi", hint: `${notYet} peserta belum absen hari ini` };
  } else if (!closed && nowMin >= workEnd && noActivity > 0) {
    next = { label: "Periksa aktivitas", href: "/admin/aktivitas", hint: `${noActivity} peserta belum mencatat aktivitas` };
  } else if (evalMonth && unevaluated > 0) {
    next = { label: "Isi evaluasi", href: `/admin/evaluasi?month=${evalMonth}`, hint: `${unevaluated} peserta belum dinilai untuk ${formatMonth(evalMonth)}` };
  }

  return { steps, next, counts: { pending, notYet, noActivity, unevaluated }, evalMonth, closed };
}
