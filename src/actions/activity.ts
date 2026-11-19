"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayDate } from "@/lib/dates";
import {
  failure,
  str,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

const activitySchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter").max(120),
  description: z.string().max(2000, "Deskripsi maksimal 2000 karakter"),
});

/** Aktivitas "bekerja" hanya bisa dicatat setelah absen masuk hari ini. */
export async function addWorkActivity(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("INTERN");
  const today = todayDate();

  const parsed = activitySchema.safeParse({
    title: str(formData, "title"),
    description: str(formData, "description"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const attendance = await db.attendance.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
  if (!attendance) {
    return failure("Absen masuk dulu sebelum mencatat aktivitas bekerja.");
  }
  if (attendance.status === "PERMIT" || attendance.status === "SICK") {
    return failure(
      "Hari ini Anda tercatat tidak bekerja (izin/sakit), aktivitas kerja tidak bisa ditambahkan.",
    );
  }

  await db.activity.create({
    data: {
      userId: user.id,
      attendanceId: attendance.id,
      date: today,
      type: "WORK",
      title: parsed.data.title,
      description: parsed.data.description || null,
    },
  });

  revalidatePath("/aktivitas");
  revalidatePath("/dashboard");
  return success("Aktivitas ditambahkan.");
}

export async function deleteWorkActivity(id: string): Promise<ActionResult> {
  const user = await requireUser("INTERN");
  // Hanya aktivitas kerja milik sendiri pada hari ini.
  const res = await db.activity.deleteMany({
    where: { id, userId: user.id, type: "WORK", date: todayDate() },
  });
  if (res.count === 0) {
    return failure("Aktivitas tidak ditemukan atau sudah tidak bisa dihapus.");
  }
  revalidatePath("/aktivitas");
  revalidatePath("/dashboard");
  return success("Aktivitas dihapus.");
}
