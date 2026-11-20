import "server-only";
import { db } from "./db";
import { pushToUsers } from "./push";
import { todayDate } from "./dates";
import type { NotificationType } from "@/generated/prisma/enums";

type NotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  refId?: string;
};

/**
 * Kirim notifikasi ke beberapa user: di aplikasi + push ke perangkat yang terdaftar.
 * Gagal kirim tidak boleh menggagalkan aksi utama.
 */
export async function notify(
  userIds: string[],
  n: NotificationInput,
  opts: { push?: boolean; tag?: string } = {},
) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  try {
    await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...n })) });
  } catch (err) {
    console.error("Gagal membuat notifikasi", n.type, err);
    return;
  }
  if (opts.push === false) return;
  try {
    await pushToUsers(ids, { title: n.title, body: n.body, url: n.href, tag: opts.tag });
  } catch (err) {
    console.error("Gagal mengirim push", n.type, err);
  }
}

/** Admin tim untuk `teamId` + semua admin utama yang aktif. */
export async function notifyTeamAdmins(teamId: string, n: NotificationInput) {
  const admins = await db.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: "SUPER_ADMIN" }, { role: "TEAM_ADMIN", teamId }],
    },
    select: { id: true },
  });
  await notify(admins.map((a) => a.id), n);
}

/**
 * Pengingat survei untuk peserta yang periode magangnya sudah berakhir
 * dan belum mengisi survei. Dibuat sekali per pendaftaran.
 */
export async function ensureSurveyReminders(userId: string) {
  const ended = await db.registration.findMany({
    where: { userId, status: "APPROVED", endDate: { lte: todayDate() }, survey: null },
    select: { id: true, team: { select: { name: true } } },
  });
  if (ended.length === 0) return;
  const existing = await db.notification.findMany({
    where: { userId, type: "SURVEY_REMINDER", refId: { in: ended.map((r) => r.id) } },
    select: { refId: true },
  });
  const has = new Set(existing.map((e) => e.refId));
  for (const r of ended.filter((r) => !has.has(r.id))) {
    await notify([userId], {
      type: "SURVEY_REMINDER",
      title: "Periode magang selesai 🎓",
      body: `Isi survei akhir magang tim ${r.team.name} untuk mendapatkan sertifikat.`,
      href: "/sertifikat",
      refId: r.id,
    });
  }
}

export async function getNotifications(userId: string, take = 10) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, type: true, title: true, body: true, href: true, readAt: true, createdAt: true },
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}
