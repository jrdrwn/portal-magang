"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireIntern } from "@/lib/auth";
import { issueCertificate } from "@/lib/certificate";
import { todayDate } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { failure, str, validationFailure, type ActionResult } from "@/lib/action-result";

const rating = z
  .string()
  .min(1, "Pilih salah satu nilai")
  .transform(Number)
  .pipe(z.number().int().min(1, "Pilih nilai 1–5").max(5, "Pilih nilai 1–5"));

const schema = z.object({
  overall: rating,
  relevance: rating,
  mentoring: rating,
  environment: rating,
  recommend: rating,
  highlights: z.string().min(10, "Ceritakan minimal 10 karakter").max(1000, "Maksimal 1000 karakter"),
  suggestions: z.string().max(1000, "Maksimal 1000 karakter"),
});

export async function submitSurvey(registrationId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireIntern();

  const reg = await db.registration.findFirst({
    where: { id: registrationId, userId: user.id, status: "APPROVED" },
    include: { survey: { select: { id: true } }, team: { select: { name: true } } },
  });
  if (!reg) return failure("Pendaftaran tidak ditemukan.");
  if (reg.endDate > todayDate()) {
    return failure("Survei baru bisa diisi saat periode magang berakhir.");
  }
  if (reg.survey) return failure("Survei untuk periode ini sudah diisi.");

  const parsed = schema.safeParse({
    overall: str(formData, "overall"),
    relevance: str(formData, "relevance"),
    mentoring: str(formData, "mentoring"),
    environment: str(formData, "environment"),
    recommend: str(formData, "recommend"),
    highlights: str(formData, "highlights"),
    suggestions: str(formData, "suggestions"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  try {
    await db.surveyResponse.create({
      data: {
        registrationId,
        userId: user.id,
        ...parsed.data,
        suggestions: parsed.data.suggestions || null,
      },
    });
  } catch {
    return failure("Survei untuk periode ini sudah diisi.");
  }

  const cert = await issueCertificate(registrationId);
  await db.notification.updateMany({
    where: { userId: user.id, type: "SURVEY_REMINDER", refId: registrationId, readAt: null },
    data: { readAt: new Date() },
  });
  await notify([user.id], {
    type: "CERTIFICATE_ISSUED",
    title: "Sertifikat magang terbit 🎓",
    body: `Sertifikat No. ${cert.number} untuk tim ${reg.team.name} siap diunduh.`,
    href: `/cetak/sertifikat/${cert.id}`,
    refId: registrationId,
  });

  revalidatePath("/sertifikat");
  revalidatePath("/admin", "layout");
  redirect("/sertifikat");
}
