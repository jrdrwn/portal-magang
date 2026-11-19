"use server";

import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { internInTeam } from "@/lib/queries";
import { failure, success, type ActionResult } from "@/lib/action-result";

// Tanpa karakter yang mirip (0/O, 1/l/I) agar mudah didiktekan.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function temporaryPassword(length = 12) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/**
 * Reset password ke password sementara (pengganti "lupa password" karena belum ada email).
 * - Admin utama: semua akun selain dirinya.
 * - Admin tim: hanya peserta di timnya.
 * Semua sesi akun tersebut otomatis keluar.
 */
export async function resetPassword(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.id === userId) {
    return failure("Untuk akun sendiri, gunakan ganti password.");
  }

  const where =
    admin.role === "SUPER_ADMIN"
      ? { id: userId }
      : { id: userId, role: "INTERN" as const, ...internInTeam(admin.teamId ?? "__no_team__") };
  const target = await db.user.findFirst({ where, select: { id: true, email: true } });
  if (!target) return failure("Akun tidak ditemukan.");

  const password = temporaryPassword();
  await db.user.update({
    where: { id: target.id },
    data: { passwordHash: await bcrypt.hash(password, 10), passwordChangedAt: new Date() },
  });
  revalidatePath("/admin", "layout");
  return success(
    `Password sementara untuk ${target.email}: ${password} — sampaikan ke pemilik akun dan minta segera menggantinya. Password ini tidak ditampilkan lagi.`,
  );
}
