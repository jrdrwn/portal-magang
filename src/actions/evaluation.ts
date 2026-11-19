"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, teamScope } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import {
  ASPECTS,
  averageScore,
  currentMonthKey,
  formatMonth,
  isValidMonthKey,
  monthEnd,
  monthStart,
} from "@/lib/evaluation";
import {
  failure,
  str,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

const score = z
  .string()
  .min(1, "Nilai wajib diisi")
  .transform(Number)
  .pipe(
    z
      .number("Harus angka")
      .int("Harus bilangan bulat")
      .min(0, "Nilai 0–100")
      .max(100, "Nilai 0–100"),
  );

const schema = z.object({
  discipline: score,
  workQuality: score,
  communication: score,
  initiative: score,
  teamwork: score,
  notes: z.string().max(2000, "Catatan maksimal 2000 karakter"),
});

export async function saveEvaluation(
  registrationId: string,
  month: string,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const scope = teamScope(admin);

  if (!isValidMonthKey(month) || month > currentMonthKey()) {
    return failure("Bulan tidak valid. Evaluasi hanya untuk bulan yang sudah berjalan.");
  }

  const reg = await db.registration.findUnique({ where: { id: registrationId } });
  if (!reg || reg.status !== "APPROVED" || (scope && reg.teamId !== scope)) {
    return failure("Peserta tidak ditemukan.");
  }
  const start = monthStart(month);
  if (reg.startDate > monthEnd(month) || reg.endDate < start) {
    return failure("Bulan ini di luar periode magang peserta.");
  }

  const raw = Object.fromEntries(ASPECTS.map((a) => [a.key, str(formData, a.key)]));
  const parsed = schema.safeParse({ ...raw, notes: str(formData, "notes") });
  if (!parsed.success) return validationFailure(parsed.error);
  const { notes, ...scores } = parsed.data;

  const before = await db.evaluation.findUnique({
    where: { registrationId_month: { registrationId, month: start } },
    select: { id: true },
  });
  await db.evaluation.upsert({
    where: { registrationId_month: { registrationId, month: start } },
    create: {
      registrationId,
      internId: reg.userId,
      evaluatorId: admin.id,
      month: start,
      ...scores,
      notes: notes || null,
    },
    update: { ...scores, notes: notes || null, evaluatorId: admin.id },
  });

  await notify([reg.userId], {
    type: "EVALUATION_PUBLISHED",
    title: before ? `Evaluasi ${formatMonth(month)} diperbarui` : `Evaluasi ${formatMonth(month)} tersedia`,
    body: `Nilai rata-rata Anda ${averageScore(scores)}. Lihat detail dan catatan dari admin tim.`,
    href: "/evaluasi",
    refId: registrationId,
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/evaluasi");
  return success("Evaluasi disimpan.");
}
