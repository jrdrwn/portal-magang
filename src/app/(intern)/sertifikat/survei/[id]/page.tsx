import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { submitSurvey } from "@/actions/survey";
import { ActionForm, Field, RatingField } from "@/components/ui/form";
import { Card, CardTitle, PageHeader } from "@/components/ui/ui";
import { requireIntern } from "@/lib/auth";
import { SURVEY_QUESTIONS } from "@/lib/certificate";
import { db } from "@/lib/db";
import { formatDate, todayDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Survei akhir magang" };

export default async function SurveyPage({ params }: PageProps<"/sertifikat/survei/[id]">) {
  const user = await requireIntern();
  const { id } = await params;

  const reg = await db.registration.findFirst({
    where: { id, userId: user.id, status: "APPROVED" },
    include: { team: { select: { name: true } }, survey: { select: { id: true } } },
  });
  if (!reg) notFound();
  if (reg.survey || reg.endDate > todayDate()) redirect("/sertifikat");

  return (
    <>
      <Link
        href="/sertifikat"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Sertifikat
      </Link>
      <PageHeader
        title="Survei akhir magang"
        description={`Tim ${reg.team.name} · ${formatDate(reg.startDate)} – ${formatDate(reg.endDate)}. Jawaban dipakai untuk memperbaiki program, tidak memengaruhi nilai.`}
      />

      <Card className="max-w-3xl">
        <CardTitle title="Penilaian" hint="1 = sangat kurang, 5 = sangat baik" />
        <ActionForm
          action={submitSurvey.bind(null, reg.id)}
          submitLabel="Kirim survei & terbitkan sertifikat"
          variant="brand"
          className="space-y-6"
        >
          {SURVEY_QUESTIONS.map((q) => (
            <RatingField key={q.key} label={q.label} name={q.key} />
          ))}
          <Field
            label="Hal paling bermanfaat selama magang"
            name="highlights"
            as="textarea"
            maxLength={1000}
            placeholder="Contoh: belajar alur kerja tim, membuat fitur dari awal sampai rilis…"
          />
          <Field
            label="Saran untuk program magang (opsional)"
            name="suggestions"
            as="textarea"
            maxLength={1000}
          />
        </ActionForm>
      </Card>
    </>
  );
}
