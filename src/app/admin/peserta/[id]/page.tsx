import type { Metadata } from "next";
import { DocumentLinks } from "@/components/document-links";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setUserActive } from "@/actions/admin";
import { resetPassword } from "@/actions/password-reset";
import { ActionButton } from "@/components/ui/form";
import {
  Avatar,
  Badge,
  Card,
  CardTitle,
  EmptyState,
  StatCard,
} from "@/components/ui/ui";
import { requireAdmin, teamScope } from "@/lib/auth";
import { internInTeam } from "@/lib/queries";
import { attendanceDays } from "@/lib/calendar";
import { AttendanceDays } from "@/components/attendance-days";
import { averageScore, grade } from "@/lib/evaluation";
import { db } from "@/lib/db";
import { daysBetweenInclusive, formatDate, isValidDateKey, keyToDate } from "@/lib/dates";
import {
  activityLabel,
  internshipTypeInfo,
  registrationLabel,
} from "@/lib/labels";

export const metadata: Metadata = { title: "Detail peserta" };

const formatMonthDate = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: "long", year: "numeric" }).format(d);

export default async function InternDetail({ params, searchParams }: PageProps<"/admin/peserta/[id]">) {
  const admin = await requireAdmin();
  const scope = teamScope(admin);
  const { id } = await params;

  const user = await db.user.findFirst({
    where: { id, role: "INTERN", ...internInTeam(scope) },
    include: {
      profile: true,
      registrations: {
        where: scope ? { teamId: scope } : {},
        include: {
          team: { select: { name: true } },
          certificate: { select: { id: true, number: true } },
          documents: { select: { id: true, kind: true, fileName: true, size: true }, orderBy: { kind: "asc" } },
          survey: { select: { id: true } },
        },
        orderBy: { startDate: "desc" },
      },
      evaluations: {
        where: scope ? { registration: { teamId: scope } } : {},
        orderBy: { month: "desc" },
        include: { evaluator: { select: { name: true } } },
      },
    },
  });
  if (!user) notFound();

  const scopedRegs = user.registrations.filter(
    (r) => r.status === "APPROVED" && (!scope || r.teamId === scope),
  );
  const [days, activities] = await Promise.all([
    attendanceDays(id, scopedRegs),
    db.activity.findMany({
      where: { userId: id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
  ]);
  const sum = days.summary;
  const sp = await searchParams;
  const corrected = isValidDateKey(sp.koreksi) ? sp.koreksi : null;
  const p = user.profile;

  return (
    <>
      <Link
        href="/admin/peserta"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Semua peserta
      </Link>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
              <p className="text-sm text-muted">{user.email}</p>
              <div className="mt-2">
                <Badge tone={user.isActive ? "success" : "danger"}>
                  {user.isActive ? "Akun aktif" : "Akun nonaktif"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2">
          <ActionButton
            action={resetPassword.bind(null, user.id)}
            variant="soft"
            showSuccess
            confirmText={`Reset password ${user.name}? Password lama tidak bisa dipakai lagi.`}
          >
            Reset password
          </ActionButton>
          {admin.role === "SUPER_ADMIN" ? (
          <ActionButton
            action={setUserActive.bind(null, user.id, !user.isActive)}
            variant={user.isActive ? "danger" : "primary"}
            confirmText={
              user.isActive
                ? "Nonaktifkan akun ini? Peserta tidak bisa masuk."
                : "Aktifkan kembali akun ini?"
            }
          >
            {user.isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
          </ActionButton>
          ) : null}
          </div>
        </div>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Hadir" value={sum.present + sum.late} hint={`${sum.late} terlambat`} tone="lime" />
        <StatCard label="Izin / sakit" value={sum.permit + sum.sick} hint={`${sum.permit} izin · ${sum.sick} sakit`} tone="sky" />
        <StatCard label="Alpa" value={sum.absent} hint="hari kerja tanpa catatan" tone="peach" />
        <StatCard label="Hari kerja" value={sum.workdays} hint={`${sum.holiday} hari libur dilewati`} tone="light" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Card>
            <CardTitle title="Data diri" />
            <dl className="space-y-3 text-sm">
              {[
                ["Telepon", p?.phone],
                ["Sekolah / kampus", p?.institution],
                ["Jurusan", p?.major],
                ["NIM / NIS", p?.studentId],
                ["Tanggal lahir", p?.birthDate ? formatDate(p.birthDate) : null],
                ["Alamat", p?.address],
                ["Bio", p?.bio],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v || "-"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardTitle title="Pendaftaran" />
            {user.registrations.length === 0 ? (
              <EmptyState title="Belum mendaftar" />
            ) : (
              <ul className="space-y-2">
                {user.registrations.map((r) => (
                  <li key={r.id} className="rounded-3xl bg-canvas/70 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{r.team.name}</p>
                        <p className="text-xs font-semibold text-brand-700">
                          {internshipTypeInfo[r.type].label}
                          {r.graduationYear ? ` · lulus ${r.graduationYear}` : ""}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(r.startDate)} – {formatDate(r.endDate)} ·{" "}
                          {daysBetweenInclusive(r.startDate, r.endDate)} hari
                        </p>
                      </div>
                      <Badge tone={registrationLabel[r.status].tone}>
                        {registrationLabel[r.status].label}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <DocumentLinks docs={r.documents} />
                    </div>
                    {r.status === "APPROVED" ? (
                      <Link
                        href={`/cetak/laporan/${r.id}`}
                        className="mt-2 mr-3 inline-block text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Laporan magang <ArrowRight className="inline size-3" aria-hidden />
                      </Link>
                    ) : null}
                    {r.certificate ? (
                      <Link
                        href={`/cetak/sertifikat/${r.certificate.id}`}
                        className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline"
                      >
                        Sertifikat {r.certificate.number} <ArrowRight className="inline size-3" aria-hidden />
                      </Link>
                    ) : r.status === "APPROVED" && r.endDate <= new Date() && !r.survey ? (
                      <p className="mt-2 text-xs text-muted">Periode selesai, menunggu peserta mengisi survei.</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle title="Evaluasi bulanan" />
            {user.evaluations.length === 0 ? (
              <EmptyState title="Belum ada evaluasi" />
            ) : (
              <ul className="space-y-2">
                {user.evaluations.map((e) => {
                  const avg = averageScore(e);
                  const g = grade(avg);
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3 rounded-3xl bg-canvas/70 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold capitalize">{formatMonthDate(e.month)}</p>
                        <p className="text-xs text-muted">
                          Dinilai {e.evaluator?.name ?? "-"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{avg}</span>
                        <Badge tone={g.tone}>{g.letter} · {g.label}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle title="Riwayat absensi" hint="Per hari kerja, termasuk alpa dan libur" />
            {corrected ? (
              <p role="status" className="mb-4 rounded-2xl bg-lime/50 px-4 py-3 text-sm font-medium text-[#2d4a00]">
                Koreksi absensi {formatDate(keyToDate(corrected))} tersimpan.
              </p>
            ) : null}
            <AttendanceDays rows={days.rows} correctBase={`/admin/peserta/${id}/koreksi`} />
          </Card>

          <Card>
            <CardTitle title="Aktivitas" hint="30 terbaru" />
            {activities.length === 0 ? (
              <EmptyState title="Belum ada aktivitas" />
            ) : (
              <ul className="space-y-2">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 rounded-3xl bg-canvas/70 p-4">
                    <div className="min-w-0">
                      <p className="font-semibold">{a.title}</p>
                      <p className="text-xs text-muted">{formatDate(a.date)}</p>
                      {a.description ? (
                        <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.description}</p>
                      ) : null}
                    </div>
                    <Badge tone={activityLabel[a.type].tone}>{activityLabel[a.type].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
