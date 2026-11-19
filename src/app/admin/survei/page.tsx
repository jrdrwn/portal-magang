import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar, Badge, Card, CardTitle, EmptyState, PageHeader, StatCard } from "@/components/ui/ui";
import { requireAdmin, teamScope } from "@/lib/auth";
import { SURVEY_QUESTIONS } from "@/lib/certificate";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { internshipTypeInfo } from "@/lib/labels";

export const metadata: Metadata = { title: "Survei akhir" };

const round1 = (n: number) => Math.round(n * 10) / 10;

export default async function SurveyResultsPage() {
  const admin = await requireAdmin();
  const scope = teamScope(admin);

  const responses = await db.surveyResponse.findMany({
    where: scope ? { registration: { teamId: scope } } : {},
    include: {
      user: { select: { id: true, name: true } },
      registration: {
        select: { type: true, endDate: true, team: { select: { name: true } }, certificate: { select: { id: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const avg = (key: (typeof SURVEY_QUESTIONS)[number]["key"]) =>
    responses.length ? round1(responses.reduce((s, r) => s + r[key], 0) / responses.length) : null;
  const overall = avg("overall");
  // Promotor = nilai 5 pada pertanyaan rekomendasi.
  const promoters = responses.filter((r) => r.recommend === 5).length;

  return (
    <>
      <PageHeader
        title="Survei akhir magang"
        description={`Masukan peserta yang telah menyelesaikan magang${admin.role === "TEAM_ADMIN" ? ` · ${admin.teamName ?? "tanpa tim"}` : ""}.`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Responden" value={responses.length} tone="dark" />
        <StatCard label="Kepuasan rata-rata" value={overall != null ? `${overall}/5` : "-"} tone="lime" />
        <StatCard
          label="Sangat merekomendasikan"
          value={responses.length ? `${Math.round((promoters / responses.length) * 100)}%` : "-"}
          hint="memberi nilai 5"
          tone="sky"
        />
      </div>

      {responses.length === 0 ? (
        <Card>
          <EmptyState
            title="Belum ada survei"
            description="Survei muncul setelah peserta menyelesaikan periode magang dan mengisinya."
          />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <Card className="h-fit self-start xl:sticky xl:top-6">
            <CardTitle title="Rata-rata per pertanyaan" />
            <ul className="space-y-4">
              {SURVEY_QUESTIONS.map((q) => {
                const v = avg(q.key) ?? 0;
                return (
                  <li key={q.key}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span>{q.label}</span>
                      <span className="shrink-0 font-bold">{v}</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={q.label}
                      aria-valuenow={v}
                      aria-valuemin={0}
                      aria-valuemax={5}
                      className="h-2.5 overflow-hidden rounded-full bg-canvas"
                    >
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${(v / 5) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="space-y-4">
            {responses.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link href={`/admin/peserta/${r.user.id}`} className="flex items-center gap-3 hover:underline">
                    <Avatar name={r.user.name} size="sm" />
                    <span>
                      <span className="block font-semibold">{r.user.name}</span>
                      <span className="block text-xs text-muted">
                        {r.registration.team.name} · {internshipTypeInfo[r.registration.type].label} · selesai{" "}
                        {formatDate(r.registration.endDate)}
                      </span>
                    </span>
                  </Link>
                  <div className="flex flex-wrap gap-1.5">
                    {SURVEY_QUESTIONS.map((q) => (
                      <Badge key={q.key} tone={r[q.key] >= 4 ? "success" : r[q.key] === 3 ? "warning" : "danger"}>
                        {r[q.key]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="mt-4 text-sm">
                  <span className="font-semibold">Paling bermanfaat: </span>
                  {r.highlights}
                </p>
                {r.suggestions ? (
                  <p className="mt-2 text-sm text-muted">
                    <span className="font-semibold text-ink">Saran: </span>
                    {r.suggestions}
                  </p>
                ) : null}
                {r.registration.certificate ? (
                  <Link
                    href={`/cetak/sertifikat/${r.registration.certificate.id}`}
                    className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline"
                  >
                    Lihat sertifikat <ArrowRight className="inline size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
