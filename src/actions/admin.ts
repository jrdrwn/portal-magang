"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireSuperAdmin, teamScope } from "@/lib/auth";
import { isValidClock, parseClock } from "@/lib/dates";
import {
  failure,
  str,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

const reviewSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "PENDING"]),
  note: z.string().max(500, "Catatan maksimal 500 karakter"),
});

export async function reviewRegistration(
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const scope = teamScope(admin);

  const parsed = reviewSchema.safeParse({
    id: str(formData, "id"),
    decision: str(formData, "decision"),
    note: str(formData, "note"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const { id, decision, note } = parsed.data;

  const reg = await db.registration.findUnique({ where: { id } });
  // Admin tim hanya boleh meninjau pendaftaran timnya.
  if (!reg || (scope && reg.teamId !== scope)) {
    return failure("Pendaftaran tidak ditemukan.");
  }

  if (decision === "REJECTED" && !note) {
    return {
      ok: false,
      error: "Periksa kembali isian Anda.",
      fieldErrors: { note: ["Isi alasan penolakan"] },
    };
  }

  if (decision === "APPROVED") {
    const overlap = await db.registration.findFirst({
      where: {
        userId: reg.userId,
        id: { not: reg.id },
        status: "APPROVED",
        startDate: { lte: reg.endDate },
        endDate: { gte: reg.startDate },
      },
    });
    if (overlap) {
      return failure(
        "Tidak bisa disetujui: tumpang tindih dengan pendaftaran lain yang sudah disetujui.",
      );
    }
  }

  await db.registration.update({
    where: { id },
    data: {
      status: decision,
      reviewNote: note || null,
      reviewedAt: decision === "PENDING" ? null : new Date(),
    },
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/pendaftaran");
  revalidatePath("/dashboard");
  return success(
    decision === "APPROVED"
      ? "Pendaftaran disetujui."
      : decision === "REJECTED"
        ? "Pendaftaran ditolak."
        : "Pendaftaran dikembalikan ke status menunggu.",
  );
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  if (admin.id === userId) {
    return failure("Anda tidak bisa menonaktifkan akun sendiri.");
  }
  const res = await db.user.updateMany({
    where: { id: userId, role: "INTERN" },
    data: { isActive },
  });
  if (res.count === 0) return failure("Peserta tidak ditemukan.");
  revalidatePath("/admin", "layout");
  return success(isActive ? "Akun diaktifkan." : "Akun dinonaktifkan.");
}

const num = (label: string) =>
  z.string().min(1, `${label} wajib diisi`).pipe(z.coerce.number("Harus berupa angka"));

const officeSchema = z
  .object({
    name: z.string().min(2, "Nama lokasi wajib diisi").max(80),
    latitude: num("Latitude").pipe(z.number().min(-90, "Latitude -90..90").max(90, "Latitude -90..90")),
    longitude: num("Longitude").pipe(
      z.number().min(-180, "Longitude -180..180").max(180, "Longitude -180..180"),
    ),
    radiusMeters: num("Radius").pipe(
      z.number().int("Harus bilangan bulat").min(20, "Radius minimal 20 m").max(2000, "Radius maksimal 2000 m"),
    ),
    workStart: z.string().refine(isValidClock, "Format jam HH:mm"),
    lateAfter: z.string().refine(isValidClock, "Format jam HH:mm"),
    workEnd: z.string().refine(isValidClock, "Format jam HH:mm"),
  })
  .refine((v) => parseClock(v.lateAfter) >= parseClock(v.workStart), {
    path: ["lateAfter"],
    message: "Batas terlambat tidak boleh sebelum jam masuk",
  });

export async function updateOffice(formData: FormData): Promise<ActionResult> {
  await requireSuperAdmin();

  const parsed = officeSchema.safeParse({
    name: str(formData, "name"),
    latitude: str(formData, "latitude"),
    longitude: str(formData, "longitude"),
    radiusMeters: str(formData, "radiusMeters"),
    workStart: str(formData, "workStart"),
    lateAfter: str(formData, "lateAfter"),
    workEnd: str(formData, "workEnd"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  await db.officeSetting.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data },
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/absensi");
  return success("Pengaturan lokasi & jam kerja disimpan.");
}
