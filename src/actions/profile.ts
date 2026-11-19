"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isValidDateKey, keyToDate } from "@/lib/dates";
import {
  str,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

const optional = (max: number) => z.string().max(max, `Maksimal ${max} karakter`);

const profileSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(80),
  phone: z
    .string()
    .regex(/^(\+?\d[\d\s-]{7,17})?$/, "Nomor telepon tidak valid"),
  institution: optional(120),
  major: optional(120),
  studentId: optional(40),
  birthDate: z
    .string()
    .refine((v) => v === "" || isValidDateKey(v), "Tanggal lahir tidak valid"),
  address: optional(300),
  bio: optional(500),
});

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: str(formData, "name"),
    phone: str(formData, "phone"),
    institution: str(formData, "institution"),
    major: str(formData, "major"),
    studentId: str(formData, "studentId"),
    birthDate: str(formData, "birthDate"),
    address: str(formData, "address"),
    bio: str(formData, "bio"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  const fields = {
    phone: d.phone || null,
    institution: d.institution || null,
    major: d.major || null,
    studentId: d.studentId || null,
    birthDate: d.birthDate ? keyToDate(d.birthDate) : null,
    address: d.address || null,
    bio: d.bio || null,
  };

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { name: d.name } }),
    db.profile.upsert({
      where: { userId: user.id },
      update: fields,
      create: { userId: user.id, ...fields },
    }),
  ]);

  revalidatePath("/", "layout");
  return success("Profil diperbarui.");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Password saat ini wajib diisi"),
    next: z.string().min(8, "Password baru minimal 8 karakter").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    path: ["confirm"],
    message: "Konfirmasi password tidak sama",
  });

export async function changePassword(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = passwordSchema.safeParse({
    current: str(formData, "current"),
    next: str(formData, "next"),
    confirm: str(formData, "confirm"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record || !(await bcrypt.compare(parsed.data.current, record.passwordHash))) {
    return {
      ok: false,
      error: "Periksa kembali isian Anda.",
      fieldErrors: { current: ["Password saat ini salah"] },
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) },
  });
  return success("Password diganti.");
}
