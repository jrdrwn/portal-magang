import "server-only";
import { db } from "./db";
import { getDailyPlan } from "./daily";
import { dateKey, minutesOfDay, parseClock, todayDate } from "./dates";
import { notify } from "./notifications";
import { getOfficeSetting } from "./queries";
import { getAdminPlan } from "./admin-daily";
import { formatMonth } from "./evaluation";

type Kind = "checkin" | "activity" | "checkout";

const MESSAGES: Record<Kind, (o: { lateAfter: string; workEnd: string }, late: boolean) => { title: string; body: string; href: string }> = {
  checkin: (o, late) =>
    late
      ? { title: "Anda belum absen masuk", body: `Sudah lewat ${o.lateAfter}. Absen sekarang agar tidak tercatat alpa.`, href: "/absensi" }
      : { title: "Waktunya absen masuk", body: `Absen tepat waktu sampai ${o.lateAfter}.`, href: "/absensi" },
  activity: (o) => ({ title: "Jangan lupa catat aktivitas", body: `Tulis pekerjaan hari ini sebelum pulang (${o.workEnd}).`, href: "/aktivitas" }),
  checkout: (o) => ({ title: "Jangan lupa absen pulang", body: `Jam pulang ${o.workEnd} sudah lewat. Absen pulang sebelum meninggalkan kantor.`, href: "/absensi" }),
};

/**
 * Buat pengingat harian yang jatuh tempo.
 * - `userIds` kosong = semua peserta (dipanggil cron); diisi = hanya user itu (saat membuka aplikasi).
 * - `push` false = hanya notifikasi di aplikasi (user sedang membuka aplikasi).
 * Setiap jenis pengingat dikirim paling banyak sekali per hari per peserta.
 */
export async function runDailyReminders(opts: { userIds?: string[]; push?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const today = todayDate(now);
  const key = dateKey(now);
  const office = await getOfficeSetting();
  const nowMin = minutesOfDay(now);
  const workStart = parseClock(office.workStart);
  const lateAfter = parseClock(office.lateAfter);
  const workEnd = parseClock(office.workEnd);

  // Belum ada pengingat yang jatuh tempo sebelum 15 menit menjelang jam masuk.
  if (nowMin < workStart - 15) return { checked: 0, sent: 0 };

  const interns = await db.user.findMany({
    where: {
      role: "INTERN",
      isActive: true,
      reminders: true,
      ...(opts.userIds ? { id: { in: opts.userIds } } : {}),
      registrations: { some: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } } },
    },
    select: { id: true },
  });

  let sent = 0;
  for (const { id } of interns) {
    const plan = await getDailyPlan(id, now);
    if (plan.kind !== "work") continue;
    const [checkin, activity, checkout] = plan.steps;

    const due: Kind[] = [];
    if (checkin.state !== "done" && nowMin < workEnd) due.push("checkin");
    if (checkin.state === "done" && activity.state !== "done" && nowMin >= workEnd - 60) due.push("activity");
    if (checkin.state === "done" && checkout.state !== "done" && nowMin >= workEnd + 15) due.push("checkout");
    if (due.length === 0) continue;

    for (const kind of due) {
      const refId = `harian:${key}:${kind}`;
      // Klaim secara atomik: bila permintaan lain (cron/lonceng) sudah mengirim, lewati.
      const claimed = await db.reminderSent.createMany({ data: [{ userId: id, key: refId }], skipDuplicates: true });
      if (claimed.count === 0) continue;
      const msg = MESSAGES[kind](office, kind === "checkin" && nowMin > lateAfter);
      await notify([id], { type: "DAILY_REMINDER", ...msg, refId }, { push: opts.push ?? true, tag: `harian-${kind}` });
      sent++;
    }
  }
  return { checked: interns.length, sent };
}

/**
 * Pengingat untuk admin (admin utama: semua tim; admin tim: timnya):
 * - pendaftaran menunggu (mulai jam masuk), sekali sehari
 * - peserta belum absen (30 menit setelah batas terlambat), sekali sehari
 * - evaluasi belum diisi: sekali di akhir bulan (tgl 25+) dan sekali di awal bulan berikutnya (tgl 1–5)
 */
export async function runAdminReminders(opts: { userIds?: string[]; push?: boolean; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const key = dateKey(now);
  const office = await getOfficeSetting();
  const nowMin = minutesOfDay(now);
  if (nowMin < parseClock(office.workStart)) return { checked: 0, sent: 0 };

  const admins = await db.user.findMany({
    where: {
      role: { in: ["SUPER_ADMIN", "TEAM_ADMIN"] },
      isActive: true,
      reminders: true,
      ...(opts.userIds ? { id: { in: opts.userIds } } : {}),
    },
    select: { id: true, name: true, email: true, role: true, teamId: true, team: { select: { name: true } } },
  });

  let sent = 0;
  for (const a of admins) {
    const plan = await getAdminPlan({ ...a, teamName: a.team?.name ?? null }, now);
    const { pending, notYet, unevaluated } = plan.counts;
    const items: { key: string; title: string; body: string; href: string }[] = [];
    if (pending > 0) {
      items.push({
        key: `harian:${key}:admin-pendaftaran`,
        title: `${pending} pendaftaran menunggu`,
        body: "Tinjau dan setujui/tolak pendaftaran magang.",
        href: "/admin/pendaftaran",
      });
    }
    if (!plan.closed && notYet > 0 && nowMin >= parseClock(office.lateAfter) + 30) {
      items.push({
        key: `harian:${key}:admin-kehadiran`,
        title: `${notYet} peserta belum absen`,
        body: `Sudah lewat ${office.lateAfter}. Cek monitor absensi atau hubungi peserta.`,
        href: "/admin/absensi",
      });
    }
    if (plan.evalMonth && unevaluated > 0) {
      const phase = Number(key.slice(8, 10)) >= 25 ? "akhir" : "awal";
      items.push({
        key: `evaluasi:${plan.evalMonth}:${phase}`,
        title: `Evaluasi ${formatMonth(plan.evalMonth)} belum lengkap`,
        body: `${unevaluated} peserta belum dinilai.`,
        href: `/admin/evaluasi?month=${plan.evalMonth}`,
      });
    }
    for (const it of items) {
      const claimed = await db.reminderSent.createMany({ data: [{ userId: a.id, key: it.key }], skipDuplicates: true });
      if (claimed.count === 0) continue;
      await notify([a.id], { type: "DAILY_REMINDER", title: it.title, body: it.body, href: it.href, refId: it.key }, { push: opts.push ?? true, tag: it.key.split(":")[2] ?? "evaluasi" });
      sent++;
    }
  }
  return { checked: admins.length, sent };
}
