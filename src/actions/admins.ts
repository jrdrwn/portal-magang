"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import {
  failure,
  str,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

const adminSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(80),
    email: z.email("Email tidak valid").max(120),
    password: z.string().min(8, "Password minimal 8 karakter").max(72),
    role: z.enum(["SUPER_ADMIN", "TEAM_ADMIN"], "Pilih peran"),
    teamId: z.string(),
  })
  .refine((v) => v.role !== "TEAM_ADMIN" || v.teamId !== "", {
    path: ["teamId"],
    message: "Pilih tim untuk admin tim",
  });

export async function createAdmin(formData: FormData): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const parsed = adminSchema.safeParse({
    name: str(formData, "name"),
    email: str(formData, "email").toLowerCase(),
    password: str(formData, "password"),
    role: str(formData, "role"),
    teamId: str(formData, "teamId"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  if (await db.user.findUnique({ where: { email: d.email } })) {
    return {
      ok: false,
      error: "Periksa kembali isian Anda.",
      fieldErrors: { email: ["Email sudah terdaftar"] },
    };
  }
  if (d.role === "TEAM_ADMIN" && !(await db.team.findUnique({ where: { id: d.teamId } }))) {
    return {
      ok: false,
      error: "Periksa kembali isian Anda.",
      fieldErrors: { teamId: ["Tim tidak ditemukan"] },
    };
  }

  const created = await db.user.create({
    data: {
      name: d.name,
      email: d.email,
      passwordHash: await bcrypt.hash(d.password, 10),
      role: d.role,
      teamId: d.role === "TEAM_ADMIN" ? d.teamId : null,
    },
  });
  await audit(me, "admin.create", {
    summary: `${d.name} (${d.email}) · ${d.role === "SUPER_ADMIN" ? "admin utama" : "admin tim"}`,
    targetType: "User",
    targetId: created.id,
    teamId: created.teamId,
  });
  revalidatePath("/admin", "layout");
  return success(`Akun admin ${d.email} dibuat.`);
}

/** Pindahkan admin tim ke tim lain. */
export async function setAdminTeam(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const teamId = str(formData, "teamId");
  if (!teamId || !(await db.team.findUnique({ where: { id: teamId } }))) {
    return failure("Pilih tim yang valid.");
  }
  const res = await db.user.updateMany({
    where: { id: userId, role: "TEAM_ADMIN" },
    data: { teamId },
  });
  if (res.count === 0) return failure("Admin tim tidak ditemukan.");
  const [u, t] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    db.team.findUnique({ where: { id: teamId }, select: { name: true } }),
  ]);
  await audit(me, "admin.move_team", { summary: `${u?.name} → tim ${t?.name}`, targetType: "User", targetId: userId, teamId });
  revalidatePath("/admin", "layout");
  return success("Tim admin diperbarui.");
}

export async function setAdminActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  if (me.id === userId) return failure("Anda tidak bisa menonaktifkan akun sendiri.");

  if (!isActive) {
    // Selalu sisakan minimal satu admin utama yang aktif.
    const target = await db.user.findUnique({ where: { id: userId } });
    if (target?.role === "SUPER_ADMIN") {
      const others = await db.user.count({
        where: { role: "SUPER_ADMIN", isActive: true, id: { not: userId } },
      });
      if (others === 0) return failure("Harus ada minimal satu admin utama yang aktif.");
    }
  }

  const res = await db.user.updateMany({
    where: { id: userId, role: { in: ["SUPER_ADMIN", "TEAM_ADMIN"] } },
    data: { isActive },
  });
  if (res.count === 0) return failure("Admin tidak ditemukan.");
  const u = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  await audit(me, isActive ? "user.activate" : "user.deactivate", { summary: `${u?.name} (${u?.email}) · admin`, targetType: "User", targetId: userId });
  revalidatePath("/admin", "layout");
  return success(isActive ? "Akun admin diaktifkan." : "Akun admin dinonaktifkan.");
}
