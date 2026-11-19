import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
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
  Table,
  Td,
  Th,
} from "@/components/ui/ui";
import { requireAdmin, teamScope } from "@/lib/auth";
import { internInTeam } from "@/lib/queries";
import { averageScore, grade } from "@/lib/evaluation";
import { db } from "@/lib/db";
import { daysBetweenInclusive, formatDate, formatTime } from "@/lib/dates";
import { formatDistance, mapsUrl } from "@/lib/geo";
import {
  activityLabel,
  attendanceLabel,
  internshipTypeInfo,
  registrationLabel,
} from "@/lib/labels";

export const metadata: Metadata = { title: "Detail peserta" };

const formatMonthDate = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: "long", year: "numeric" }).format(d);

export default async function InternDetail({ params }: PageProps<"/admin/peserta/[id]">) {
  const admin = await requireAdmin();
  const scope = teamScope(admin);
  const { id } = await params;

  const user = await db.user.findFirst({
    where: { id, role: "INTERN", ...internInTeam(scope) },
    include: {
      profile: true,
      registrations: {
        include: { team: { select: { name: true } } },
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

  const [attendances, activities, grouped] = await Promise.all([
    db.attendance.findMany({ where: { userId: id }, orderBy: { date: "desc" }, take: 60 }),
    db.activity.findMany({
      where: { userId: id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
    db.attendance.groupBy({ by: ["status"], where: { userId: id }, _count: { _all: true } }),
  ]);
  const n = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
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
        <StatCard label="Hadir" value={n("PRESENT")} tone="lime" />
        <StatCard label="Terlambat" value={n("LATE")} tone="peach" />
        <StatCard label="Izin" value={n("PERMIT")} tone="sky" />
        <StatCard label="Sakit" value={n("SICK")} tone="light" />
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
            <CardTitle title="Riwayat absensi" hint="60 catatan terakhir" />
            {attendances.length === 0 ? (
              <EmptyState title="Belum ada absensi" />
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>Tanggal</Th>
                      <Th>Status</Th>
                      <Th>Masuk</Th>
                      <Th>Pulang</Th>
                      <Th>Jarak</Th>
                      <Th>Peta</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendances.map((a) => (
                      <tr key={a.id}>
                        <Td className="font-medium">{formatDate(a.date)}</Td>
                        <Td>
                          <Badge tone={attendanceLabel[a.status].tone}>
                            {attendanceLabel[a.status].label}
                          </Badge>
                        </Td>
                        <Td>{formatTime(a.checkInAt)}</Td>
                        <Td>{formatTime(a.checkOutAt)}</Td>
                        <Td>
                          {a.checkInDistance != null ? formatDistance(a.checkInDistance) : "-"}
                        </Td>
                        <Td>
                          {a.checkInLat != null && a.checkInLng != null ? (
                            <a
                              href={mapsUrl(a.checkInLat, a.checkInLng)}
                              target="_blank"
                              rel="noreferrer noopener"
                              aria-label="Buka peta"
                              className="text-brand-600"
                            >
                              <ExternalLink className="size-4" aria-hidden />
                            </a>
                          ) : (
                            "-"
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
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
