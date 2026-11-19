"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  daysBetweenInclusive,
  isValidDateKey,
  keyToDate,
  todayDate,
} from "@/lib/dates";
import {
  failure,
  str,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

const MAX_DURATION_DAYS = 366;

const schema = z.object({
  division: z.string().min(2, "Divisi wajib diisi").max(60),
  startDate: z.string().refine(isValidDateKey, "Tanggal mulai tidak valid"),
  endDate: z.string().refine(isValidDateKey, "Tanggal selesai tidak valid"),
  motivation: z
    .string()
    .min(10, "Ceritakan motivasi minimal 10 karakter")
    .max(1000, "Maksimal 1000 karakter"),
});

export async function createRegistration(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("INTERN");

  const parsed = schema.safeParse({
    division: str(formData, "division"),
    startDate: str(formData, "startDate"),
    endDate: str(formData, "endDate"),
    motivation: str(formData, "motivation"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const start = keyToDate(parsed.data.startDate);
  const end = keyToDate(parsed.data.endDate);
  const fieldErrors: Record<string, string[]> = {};

  if (start < todayDate()) {
    fieldErrors.startDate = ["Tanggal mulai tidak boleh sebelum hari ini"];
  }
  if (end < start) {
    fieldErrors.endDate = ["Tanggal selesai tidak boleh sebelum tanggal mulai"];
  } else if (daysBetweenInclusive(start, end) > MAX_DURATION_DAYS) {
    fieldErrors.endDate = ["Durasi magang maksimal 12 bulan"];
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", fieldErrors };
  }

  // Tidak boleh tumpang tindih dengan pendaftaran lain yang masih berlaku.
  const overlap = await db.registration.findFirst({
    where: {
      userId: user.id,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap) {
    return failure(
      overlap.status === "PENDING"
        ? "Anda masih memiliki pendaftaran yang menunggu persetujuan pada rentang tanggal tersebut."
        : "Rentang tanggal tumpang tindih dengan pendaftaran Anda yang sudah disetujui.",
    );
  }

  await db.registration.create({
    data: {
      userId: user.id,
      division: parsed.data.division,
      startDate: start,
      endDate: end,
      motivation: parsed.data.motivation,
    },
  });

  revalidatePath("/pendaftaran");
  revalidatePath("/dashboard");
  return success("Pendaftaran terkirim. Tunggu persetujuan admin.");
}

export async function cancelRegistration(id: string): Promise<ActionResult> {
  const user = await requireUser("INTERN");
  const res = await db.registration.deleteMany({
    where: { id, userId: user.id, status: "PENDING" },
  });
  if (res.count === 0) {
    return failure("Pendaftaran tidak ditemukan atau sudah diproses admin.");
  }
  revalidatePath("/pendaftaran");
  revalidatePath("/dashboard");
  return success("Pendaftaran dibatalkan.");
}
