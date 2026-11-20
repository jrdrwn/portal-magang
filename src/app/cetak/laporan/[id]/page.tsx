import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { ButtonLink } from "@/components/ui/ui";
import { isAdmin, requireUser } from "@/lib/auth";
import { attendanceDays, dayStatusLabel } from "@/lib/calendar";
import { db } from "@/lib/db";
import { daysBetweenInclusive, formatDate, formatTime, formatWeekday, todayDate } from "@/lib/dates";
import { ASPECTS, averageScore, grade } from "@/lib/evaluation";
import { attendanceLabel, internshipTypeInfo } from "@/lib/labels";
import { getOfficeSetting } from "@/lib/queries";

export const metadata: Metadata = { title: "Laporan magang", robots: { index: false } };

const monthFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: "long", year: "numeric" });

export default function ReportPage({ params }: PageProps<"/cetak/laporan/[id]">) {
  return (
    <main className="min-h-dvh px-3 py-6 sm:px-6 print:p-0">
      <style>{"@page { size: A4; margin: 14mm } @media print { html, body { background: #fff } }"}</style>
      <Suspense fallback={<div className="mx-auto h-[80dvh] max-w-[860px] animate-pulse rounded-card bg-surface" />}>
        <Report params={params} />
      </Suspense>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid-page">
      <h2 className="mb-3 border-b-2 border-brand-600 pb-1.5 text-sm font-bold uppercase tracking-wider text-brand-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

const cell = "border border-line px-2.5 py-1.5 text-left align-top";

async function Report({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const reg = await db.registration.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, profile: true } },
      team: { select: { name: true } },
      evaluations: { orderBy: { month: "asc" }, include: { evaluator: { select: { name: true } } } },
      certificate: { select: { number: true, issuedAt: true } },
    },
  });
  if (!reg || reg.status !== "APPROVED") notFound();
  const allowed =
    reg.userId === user.id ||
    user.role === "SUPER_ADMIN" ||
    (user.role === "TEAM_ADMIN" && user.teamId === reg.teamId);
  if (!allowed) notFound();

  const [office, days, activities] = await Promise.all([
    getOfficeSetting(),
    attendanceDays(reg.userId, [reg], 400),
    db.activity.findMany({
      where: { userId: reg.userId, type: "WORK", date: { gte: reg.startDate, lte: reg.endDate } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { id: true, date: true, title: true, description: true },
    }),
  ]);

  const s = days.summary;
  const attendedPct = s.workdays ? Math.round(((s.present + s.late) / s.workdays) * 100) : 0;
  const evalAvg = reg.evaluations.length
    ? Math.round((reg.evaluations.reduce((t, e) => t + averageScore(e), 0) / reg.evaluations.length) * 10) / 10
    : null;
  const finished = reg.endDate <= todayDate();
  const p = reg.user.profile;
  const rows = [...days.rows].reverse().filter((r) => r.status !== "OFF");

  return (
    <>
      <div className="mx-auto mb-5 flex max-w-[860px] flex-wrap items-center justify-between gap-3 print:hidden">
        <ButtonLink href={isAdmin(user.role) ? `/admin/peserta/${reg.userId}` : "/sertifikat"} variant="ghost">
          <ArrowLeft className="size-4" aria-hidden /> Kembali
        </ButtonLink>
        <PrintButton />
      </div>

      <article
        aria-label={`Laporan magang ${reg.user.name}`}
        className="mx-auto max-w-[860px] bg-white p-8 text-[13px] leading-relaxed text-ink shadow-card sm:p-12 print:max-w-none print:p-0 print:shadow-none"
      >
        <header className="flex items-start justify-between gap-6 border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-base font-bold">{office.orgName}</p>
              <p className="text-xs text-muted">Program Magang</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-extrabold tracking-tight">{finished ? "Laporan Akhir Magang" : "Laporan Sementara Magang"}</h1>
            <p className="text-xs text-muted">Dicetak {formatDate(todayDate(), "long")}</p>
          </div>
        </header>

        <Section title="Identitas peserta">
          <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1">
            {[
              ["Nama", reg.user.name],
              ["Email", reg.user.email],
              ["Asal sekolah/kampus", p?.institution],
              ["Jurusan", p?.major],
              ["NIM/NIS", p?.studentId],
              ["Tim", reg.team.name],
              ["Jenis magang", `${internshipTypeInfo[reg.type].label}${reg.graduationYear ? ` (lulus ${reg.graduationYear})` : ""}`],
              [
                "Periode",
                `${formatDate(reg.startDate, "long")} – ${formatDate(reg.endDate, "long")} (${daysBetweenInclusive(reg.startDate, reg.endDate)} hari)`,
              ],
              ["Sertifikat", reg.certificate ? `No. ${reg.certificate.number}, terbit ${formatDate(reg.certificate.issuedAt, "long")}` : "Belum terbit"],
            ].map(([k, v]) => (
              <div key={k as string} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium">{v || "-"}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Rekap kehadiran">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              ["Hari kerja", s.workdays],
              ["Hadir", s.present],
              ["Terlambat", s.late],
              ["Izin", s.permit],
              ["Sakit", s.sick],
              ["Alpa", s.absent],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl border border-line p-2.5 text-center">
                <p className="text-lg font-bold">{v}</p>
                <p className="text-[11px] text-muted">{k}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Persentase kehadiran {attendedPct}% (hadir + terlambat dibanding hari kerja). {s.holiday} hari libur tidak dihitung.
            {!finished ? " Dihitung sampai hari ini." : ""}
          </p>
        </Section>

        <Section title="Evaluasi bulanan">
          {reg.evaluations.length === 0 ? (
            <p className="text-muted">Belum ada evaluasi.</p>
          ) : (
            <>
              <table className="w-full border-collapse text-xs">
                <thead className="bg-canvas">
                  <tr>
                    <th className={cell}>Bulan</th>
                    {ASPECTS.map((a) => (
                      <th key={a.key} className={cell}>
                        {a.label}
                      </th>
                    ))}
                    <th className={cell}>Rata-rata</th>
                  </tr>
                </thead>
                <tbody>
                  {reg.evaluations.map((e) => (
                    <tr key={e.id}>
                      <td className={`${cell} capitalize`}>{monthFmt.format(e.month)}</td>
                      {ASPECTS.map((a) => (
                        <td key={a.key} className={cell}>
                          {e[a.key]}
                        </td>
                      ))}
                      <td className={`${cell} font-bold`}>{averageScore(e)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {evalAvg != null ? (
                <p className="mt-2">
                  Nilai akhir <b>{evalAvg}</b> · predikat <b>{grade(evalAvg).letter} ({grade(evalAvg).label})</b>
                </p>
              ) : null}
              {reg.evaluations.some((e) => e.notes) ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {reg.evaluations
                    .filter((e) => e.notes)
                    .map((e) => (
                      <li key={e.id}>
                        <span className="font-semibold capitalize">{monthFmt.format(e.month)}:</span> {e.notes}
                        {e.evaluator ? <span className="text-muted"> ({e.evaluator.name})</span> : null}
                      </li>
                    ))}
                </ul>
              ) : null}
            </>
          )}
        </Section>

        <Section title={`Aktivitas kerja (${activities.length})`}>
          {activities.length === 0 ? (
            <p className="text-muted">Belum ada aktivitas kerja tercatat.</p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="bg-canvas">
                <tr>
                  <th className={`${cell} w-28`}>Tanggal</th>
                  <th className={cell}>Aktivitas</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id} className="break-inside-avoid">
                    <td className={`${cell} whitespace-nowrap`}>{formatDate(a.date)}</td>
                    <td className={cell}>
                      <span className="font-semibold">{a.title}</span>
                      {a.description ? <span className="block whitespace-pre-line text-muted">{a.description}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Absensi harian">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-canvas">
              <tr>
                <th className={cell}>Tanggal</th>
                <th className={cell}>Status</th>
                <th className={cell}>Masuk</th>
                <th className={cell}>Pulang</th>
                <th className={cell}>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="break-inside-avoid">
                  <td className={`${cell} whitespace-nowrap`}>
                    {formatWeekday(r.date).slice(0, 3)}, {formatDate(r.date)}
                  </td>
                  <td className={cell}>
                    {r.status in attendanceLabel
                      ? attendanceLabel[r.status as keyof typeof attendanceLabel].label
                      : dayStatusLabel[r.status as keyof typeof dayStatusLabel]}
                    {r.att?.correctedAt ? " *" : ""}
                  </td>
                  <td className={cell}>{formatTime(r.att?.checkInAt)}</td>
                  <td className={cell}>{formatTime(r.att?.checkOutAt)}</td>
                  <td className={cell}>{r.holidayName ?? r.att?.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.some((r) => r.att?.correctedAt) ? (
            <p className="mt-1.5 text-[11px] text-muted">* dikoreksi oleh admin.</p>
          ) : null}
        </Section>

        <footer className="mt-12 grid grid-cols-2 gap-8 text-center break-inside-avoid">
          <div>
            <p>Peserta,</p>
            <div className="h-16" />
            <p className="border-t border-ink pt-1 font-bold">{reg.user.name}</p>
          </div>
          <div>
            <p>
              {office.certCity}, {formatDate(todayDate(), "long")}
            </p>
            <p className="font-semibold">{office.signerTitle}</p>
            <div className="h-12" />
            <p className="border-t border-ink pt-1 font-bold">{office.signerName || "\u00a0"}</p>
          </div>
        </footer>
      </article>
    </>
  );
}
