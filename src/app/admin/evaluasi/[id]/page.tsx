import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { saveEvaluation } from "@/actions/evaluation";
import { ActionForm, Field } from "@/components/ui/form";
import { Avatar, Badge, Card, CardTitle, StatCard } from "@/components/ui/ui";
import { requireAdmin, teamScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import {
  ASPECTS,
  averageScore,
  currentMonthKey,
  formatMonth,
  grade,
  isValidMonthKey,
  monthEnd,
  monthStart,
} from "@/lib/evaluation";
import { internshipTypeInfo } from "@/lib/labels";
import { summariesFor } from "@/lib/calendar";

export const metadata: Metadata = { title: "Nilai peserta" };

export default async function EvaluateIntern({
  params,
  searchParams,
}: PageProps<"/admin/evaluasi/[id]">) {
  const admin = await requireAdmin();
  const scope = teamScope(admin);
  const { id } = await params;
  const sp = await searchParams;
  const raw = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const now = currentMonthKey();
  const month = isValidMonthKey(raw) && raw <= now ? raw : now;
  const start = monthStart(month);
  const end = monthEnd(month);

  const reg = await db.registration.findFirst({
    where: { id, status: "APPROVED", ...(scope ? { teamId: scope } : {}) },
    include: {
      user: { select: { id: true, name: true, email: true } },
      team: { select: { name: true } },
      evaluations: { where: { month: start }, include: { evaluator: { select: { name: true } } } },
    },
  });
  if (!reg) notFound();
  const inPeriod = reg.startDate <= end && reg.endDate >= start;
  const existing = reg.evaluations[0];

  const [summaries, workCount] = await Promise.all([
    summariesFor([reg], start, end),
    db.activity.count({
      where: { userId: reg.userId, type: "WORK", date: { gte: start, lte: end } },
    }),
  ]);
  const sum = summaries.get(reg.userId)!;
  const avg = existing ? averageScore(existing) : null;

  return (
    <>
      <Link
        href={`/admin/evaluasi?month=${month}`}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Evaluasi {formatMonth(month)}
      </Link>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={reg.user.name} size="lg" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{reg.user.name}</h1>
              <p className="text-sm text-muted">
                {reg.team.name} · {internshipTypeInfo[reg.type].label} · {formatDate(reg.startDate)} –{" "}
                {formatDate(reg.endDate)}
              </p>
            </div>
          </div>
          {avg != null ? (
            <div className="text-right">
              <p className="text-xs text-muted">Nilai {formatMonth(month)}</p>
              <p className="text-3xl font-bold">{avg}</p>
              <Badge tone={grade(avg).tone}>
                {grade(avg).letter} · {grade(avg).label}
              </Badge>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Hadir" value={sum.present + sum.late} hint={`${sum.late} terlambat`} tone="lime" />
        <StatCard label="Izin / sakit" value={sum.permit + sum.sick} hint={`${sum.permit} izin · ${sum.sick} sakit`} tone="sky" />
        <StatCard label="Alpa" value={sum.absent} hint={`dari ${sum.workdays} hari kerja`} tone="peach" />
        <StatCard label="Aktivitas kerja" value={workCount} hint="tercatat bulan ini" tone="light" />
      </div>

      <Card>
        <CardTitle
          title={`Penilaian ${formatMonth(month)}`}
          hint={
            existing
              ? `Terakhir disimpan oleh ${existing.evaluator?.name ?? "-"}. Simpan lagi untuk mengubah.`
              : "Isi nilai 0–100 untuk setiap aspek."
          }
        />
        {!inPeriod ? (
          <p className="rounded-2xl bg-peach p-4 text-sm">
            Bulan ini di luar periode magang peserta, jadi tidak bisa dinilai.
          </p>
        ) : (
          <ActionForm action={saveEvaluation.bind(null, reg.id, month)} submitLabel="Simpan evaluasi" variant="brand">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {ASPECTS.map((a) => (
                <Field
                  key={a.key}
                  label={a.label}
                  name={a.key}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  hint={a.hint}
                  defaultValue={existing ? String(existing[a.key]) : ""}
                />
              ))}
            </div>
            <Field
              label="Catatan untuk peserta"
              name="notes"
              as="textarea"
              rows={4}
              maxLength={2000}
              defaultValue={existing?.notes ?? ""}
              placeholder="Kelebihan, hal yang perlu ditingkatkan, target bulan depan…"
            />
          </ActionForm>
        )}
      </Card>
    </>
  );
}
