import type { Metadata } from "next";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/ui";
import { requireIntern } from "@/lib/auth";
import { db } from "@/lib/db";
import { ASPECTS, averageScore, grade } from "@/lib/evaluation";

export const metadata: Metadata = { title: "Evaluasi" };

const monthFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

export default async function InternEvaluations() {
  const user = await requireIntern();
  const evaluations = await db.evaluation.findMany({
    where: { internId: user.id },
    include: {
      registration: { select: { team: { select: { name: true } } } },
      evaluator: { select: { name: true } },
    },
    orderBy: { month: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Evaluasi bulanan"
        description="Penilaian dari admin tim setiap bulan selama magang."
      />

      {evaluations.length === 0 ? (
        <Card>
          <EmptyState
            title="Belum ada evaluasi"
            description="Evaluasi muncul setelah admin tim menilai Anda untuk bulan berjalan."
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {evaluations.map((e) => {
            const avg = averageScore(e);
            const g = grade(avg);
            return (
              <Card key={e.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold capitalize">{monthFmt.format(e.month)}</p>
                    <p className="text-sm text-muted">
                      {e.registration.team.name} · dinilai {e.evaluator?.name ?? "admin"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold leading-none">{avg}</p>
                    <div className="mt-1">
                      <Badge tone={g.tone}>
                        {g.letter} · {g.label}
                      </Badge>
                    </div>
                  </div>
                </div>

                <ul className="mt-5 space-y-3">
                  {ASPECTS.map((a) => (
                    <li key={a.key}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium">{a.label}</span>
                        <span className="font-semibold">{e[a.key]}</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={a.label}
                        aria-valuenow={e[a.key]}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="h-2.5 overflow-hidden rounded-full bg-canvas"
                      >
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${e[a.key]}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>

                {e.notes ? (
                  <p className="mt-5 whitespace-pre-line rounded-2xl bg-brand-50 p-4 text-sm">
                    <span className="font-semibold">Catatan: </span>
                    {e.notes}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
