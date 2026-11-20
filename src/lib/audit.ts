import "server-only";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import type { Prisma } from "@/generated/prisma/client";

export const AUDIT_ACTIONS = {
  "registration.approve": "Menyetujui pendaftaran",
  "registration.reject": "Menolak pendaftaran",
  "registration.reopen": "Mengembalikan pendaftaran ke menunggu",
  "attendance.correct": "Mengoreksi absensi",
  "attendance.delete": "Menghapus absensi",
  "evaluation.save": "Menyimpan evaluasi",
  "user.activate": "Mengaktifkan akun",
  "user.deactivate": "Menonaktifkan akun",
  "user.reset_password": "Me-reset password",
  "admin.create": "Membuat akun admin",
  "admin.move_team": "Memindahkan admin ke tim lain",
  "team.create": "Membuat tim",
  "team.update": "Mengubah tim",
  "team.open": "Membuka pendaftaran tim",
  "team.close": "Menutup pendaftaran tim",
  "team.delete": "Menghapus tim",
  "holiday.create": "Menambah hari libur",
  "holiday.delete": "Menghapus hari libur",
  "settings.office": "Mengubah pengaturan absensi",
  "settings.certificate": "Mengubah pengaturan sertifikat",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** Catat tindakan admin. Gagal mencatat tidak boleh menggagalkan aksi utama. */
export async function audit(
  actor: Pick<CurrentUser, "id">,
  action: AuditAction,
  entry: {
    summary: string;
    targetType?: string;
    targetId?: string;
    teamId?: string | null;
    meta?: Prisma.InputJsonValue;
  },
) {
  try {
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action,
        summary: entry.summary,
        targetType: entry.targetType,
        targetId: entry.targetId,
        teamId: entry.teamId ?? null,
        meta: entry.meta,
      },
    });
  } catch (err) {
    console.error("Gagal mencatat audit log", action, err);
  }
}
