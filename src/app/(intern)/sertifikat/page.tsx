import type { Metadata } from "next";
import { Award, CalendarClock, ClipboardList, ExternalLink } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui/ui";
import { requireIntern } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysBetweenInclusive, formatDate, todayDate } from "@/lib/dates";
import { internshipTypeInfo } from "@/lib/labels";

export const metadata: Metadata = { title: "Sertifikat" };

export default async function CertificatesPage() {
  const user = await requireIntern();
  const today = todayDate();

  const regs = await db.registration.findMany({
    where: { userId: user.id, status: "APPROVED" },
    include: {
      team: { select: { name: true } },
      survey: { select: { id: true } },
      certificate: true,
    },
    orderBy: { startDate: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Sertifikat"
        description="Sertifikat terbit setelah periode magang berakhir dan Anda mengisi survei akhir."
      />

      {regs.length === 0 ? (
        <Card>
          <EmptyState
            title="Belum ada periode magang"
            description="Sertifikat tersedia untuk pendaftaran yang sudah disetujui dan selesai."
            action={
              <ButtonLink href="/pendaftaran" className="mt-2">
                Ke pendaftaran
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {regs.map((r) => {
            const ended = r.endDate <= today;
            const left = ended ? 0 : daysBetweenInclusive(today, r.endDate) - 1;
            return (
              <Card key={r.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{r.team.name}</p>
                    <p className="text-sm text-muted">
                      {internshipTypeInfo[r.type].label} · {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </p>
                  </div>
                  {r.certificate ? (
                    <Badge tone="success">Terbit</Badge>
                  ) : ended ? (
                    <Badge tone="warning">Isi survei</Badge>
                  ) : (
                    <Badge tone="neutral">Berjalan</Badge>
                  )}
                </div>

                <div className="mt-5 flex-1 rounded-3xl bg-canvas/70 p-4">
                  {r.certificate ? (
                    <div className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lime">
                        <Award className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold">No. {r.certificate.number}</p>
                        <p className="text-muted">Terbit {formatDate(r.certificate.issuedAt)}</p>
                        <p className="mt-1 text-muted">
                          Kode verifikasi <span className="font-mono font-semibold text-ink">{r.certificate.code}</span>
                        </p>
                      </div>
                    </div>
                  ) : ended ? (
                    <div className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-peach">
                        <ClipboardList className="size-5" aria-hidden />
                      </span>
                      <p className="text-sm">
                        Periode magang sudah selesai. Isi survei singkat (±2 menit) untuk menerbitkan sertifikat.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sky">
                        <CalendarClock className="size-5" aria-hidden />
                      </span>
                      <p className="text-sm">
                        Sertifikat bisa diambil mulai <b>{formatDate(r.endDate, "long")}</b>
                        {left > 0 ? ` (${left} hari lagi)` : ""}. Survei akhir terbuka di hari itu.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {r.certificate ? (
                    <>
                      <ButtonLink href={`/cetak/sertifikat/${r.certificate.id}`} variant="brand">
                        <Award className="size-4" aria-hidden />
                        Lihat & unduh
                      </ButtonLink>
                      <ButtonLink href={`/verifikasi/${r.certificate.code}`} variant="soft" target="_blank">
                        Halaman verifikasi <ExternalLink className="size-3.5" aria-hidden />
                      </ButtonLink>
                    </>
                  ) : ended ? (
                    <ButtonLink href={`/sertifikat/survei/${r.id}`} variant="brand">
                      Isi survei akhir
                    </ButtonLink>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
