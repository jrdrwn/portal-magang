import "server-only";
import { db } from "./db";
import { nonWorkingReason } from "./calendar";
import { formatTime, minutesOfDay, parseClock, todayDate } from "./dates";
import { getActiveRegistration, getOfficeSetting } from "./queries";

import { clock, type StepState } from "./steps";

export type DailyStep = {
  key: "checkin" | "activity" | "checkout";
  label: string;
  state: StepState;
  /** Keterangan singkat, mis. "07:55" atau "batas 08:15". */
  detail: string;
};

export type DailyPlan =
  | { kind: "none" } // tidak ada periode magang aktif
  | { kind: "off"; reason: string } // hari libur / bukan hari kerja
  | { kind: "absent"; label: string; note: string | null } // izin / sakit
  | {
      kind: "work";
      steps: DailyStep[];
      done: number;
      next: { label: string; href: string; hint: string } | null;
    };


/** Langkah harian peserta untuk hari ini (WIB). `now` bisa diisi untuk pengujian. */
export async function getDailyPlan(userId: string, now: Date = new Date()): Promise<DailyPlan> {
  const today = todayDate(now);
  const active = await getActiveRegistration(userId, today);
  if (!active) return { kind: "none" };

  const [closed, office, attendance] = await Promise.all([
    nonWorkingReason(today),
    getOfficeSetting(),
    db.attendance.findUnique({
      where: { userId_date: { userId, date: today } },
      include: { _count: { select: { activities: { where: { type: "WORK" } } } } },
    }),
  ]);

  if (attendance && (attendance.status === "PERMIT" || attendance.status === "SICK")) {
    return { kind: "absent", label: attendance.status === "SICK" ? "Sakit" : "Izin", note: attendance.note };
  }
  if (closed && !attendance) return { kind: "off", reason: closed };

  const nowMin = minutesOfDay(now);
  const lateAfter = parseClock(office.lateAfter);
  const workEnd = parseClock(office.workEnd);
  const checkedIn = Boolean(attendance?.checkInAt);
  const activities = attendance?._count.activities ?? 0;
  const checkedOut = Boolean(attendance?.checkOutAt);

  const checkin: DailyStep = checkedIn
    ? { key: "checkin", label: "Absen masuk", state: "done", detail: formatTime(attendance!.checkInAt) + (attendance!.status === "LATE" ? " · terlambat" : "") }
    : { key: "checkin", label: "Absen masuk", state: nowMin > lateAfter ? "late" : "current", detail: nowMin > lateAfter ? `lewat ${office.lateAfter}` : `sebelum ${office.lateAfter}` };

  const activity: DailyStep =
    activities > 0
      ? { key: "activity", label: "Catat aktivitas", state: "done", detail: `${activities} aktivitas` }
      : {
          key: "activity",
          label: "Catat aktivitas",
          state: !checkedIn ? "upcoming" : nowMin >= workEnd ? "late" : "current",
          detail: !checkedIn ? "setelah absen masuk" : `sebelum ${office.workEnd}`,
        };

  const checkout: DailyStep = checkedOut
    ? { key: "checkout", label: "Absen pulang", state: "done", detail: formatTime(attendance!.checkOutAt) }
    : {
        key: "checkout",
        label: "Absen pulang",
        state: !checkedIn ? "upcoming" : nowMin >= workEnd ? (activities > 0 ? "current" : "late") : "upcoming",
        detail: `mulai ${office.workEnd}`,
      };

  const steps = [checkin, activity, checkout];
  const done = steps.filter((s) => s.state === "done").length;

  let next: { label: string; href: string; hint: string } | null = null;
  if (!checkedIn) {
    next = {
      label: "Absen masuk",
      href: "/absensi",
      hint: nowMin <= lateAfter ? `Tepat waktu sampai ${office.lateAfter} (${lateAfter - nowMin} menit lagi)` : `Sudah lewat ${office.lateAfter}, tetap absen agar tidak alpa`,
    };
  } else if (activities === 0) {
    next = { label: "Catat aktivitas", href: "/aktivitas", hint: "Tulis apa yang Anda kerjakan hari ini" };
  } else if (!checkedOut) {
    next =
      nowMin >= workEnd
        ? { label: "Absen pulang", href: "/absensi", hint: `Jam pulang ${office.workEnd} sudah lewat` }
        : { label: "Tambah aktivitas", href: "/aktivitas", hint: `Absen pulang mulai ${office.workEnd} (${clock(workEnd - nowMin)} lagi)` };
  }

  return { kind: "work", steps, done, next };
}
