import type { Metadata } from "next";
import { CalendarCheck, CircleSlash, Clock, HeartPulse, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireIntern } from "@/lib/auth";
import {
  daysBetweenInclusive,
  formatDate,
  formatTime,
  formatWeekday,
  todayDate,
} from "@/lib/dates";
import { registrationSummary } from "@/lib/calendar";
import {
  getActiveRegistration,
  getTodayAttendance,
} from "@/lib/queries";
import {
  activityLabel,
  attendanceLabel,
  internshipTypeInfo,
  registrationLabel,
} from "@/lib/labels";
import {
  Badge,
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui/ui";

export const metadata: Metadata = { title: "Beranda" };

export default async function DashboardPage() {
  const user = await requireIntern();
  const today = todayDate();

  const [active, upcoming, pending, attendance, recent, needSurvey] = await Promise.all([
    getActiveRegistration(user.id, today),
    db.registration.findFirst({
      where: { userId: user.id, status: "APPROVED", startDate: { gt: today } },
      orderBy: { startDate: "asc" },
    }),
    db.registration.findFirst({
      where: { userId: user.id, status: "PENDING" },
      include: { team: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getTodayAttendance(user.id, today),
    db.activity.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    db.registration.findFirst({
      where: { userId: user.id, status: "APPROVED", endDate: { lte: today }, survey: null },
      include: { team: { select: { name: true } } },
    }),
  ]);

  const summary = active
    ? (await registrationSummary(active)).summary
    : { present: 0, late: 0, permit: 0, sick: 0, absent: 0, holiday: 0, workdays: 0 };

  const total = active ? daysBetweenInclusive(active.startDate, active.endDate) : 0;
  const elapsed = active
    ? Math.min(total, daysBetweenInclusive(active.startDate, today))
    : 0;
  const percent = total ? Math.round((elapsed / total) * 100) : 0;
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Halo, ${firstName} 👋`}
        description={`${formatWeekday(today)}, ${formatDate(today, "long")}`}
      />

      {needSurvey ? (
        <Card className="mb-6 bg-lime shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Selamat, magang Anda di tim {needSurvey.team.name} sudah selesai 🎓</p>
              <p className="text-sm text-ink/70">Isi survei akhir untuk menerbitkan sertifikat.</p>
            </div>
            <ButtonLink href={`/sertifikat/survei/${needSurvey.id}`}>Isi survei</ButtonLink>
          </div>
        </Card>
      ) : null}

      {!active && !needSurvey ? (
        <Card className="mb-6 bg-peach shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">
                {pending
                  ? "Pendaftaran Anda sedang ditinjau admin."
                  : upcoming
                    ? `Magang Anda dimulai ${formatDate(upcoming.startDate, "long")}.`
                    : "Anda belum memiliki periode magang aktif."}
              </p>
              <p className="text-sm text-ink/70">
                Absen dan aktivitas aktif setelah pendaftaran disetujui dan
                periode magang berjalan.
              </p>
            </div>
            <ButtonLink href="/pendaftaran">
              {pending || upcoming ? "Lihat pendaftaran" : "Ajukan pendaftaran"}
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-card bg-ink p-6 text-white shadow-card sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white/60">Status hari ini</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {attendance
                    ? attendance.status === "PERMIT" || attendance.status === "SICK"
                      ? `Tidak bekerja · ${attendanceLabel[attendance.status].label}`
                      : "Sedang bekerja"
                    : "Belum absen"}
                </p>
              </div>
              {attendance ? (
                <Badge tone={attendanceLabel[attendance.status].tone}>
                  {attendanceLabel[attendance.status].label}
                </Badge>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="flex items-center gap-1.5 text-xs text-white/60">
                  <Clock className="size-3.5" aria-hidden /> Masuk
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatTime(attendance?.checkInAt)}
                </p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="flex items-center gap-1.5 text-xs text-white/60">
                  <Clock className="size-3.5" aria-hidden /> Pulang
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatTime(attendance?.checkOutAt)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/absensi" variant="lime">
                <MapPin className="size-4" aria-hidden />
                {attendance ? "Lihat absensi" : "Absen sekarang"}
              </ButtonLink>
              <ButtonLink
                href="/aktivitas"
                variant="ghost"
                className="text-white hover:bg-white/10"
              >
                Catat aktivitas
              </ButtonLink>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <StatCard
              label="Hadir"
              value={summary.present + summary.late}
              hint={`${summary.late} terlambat`}
              tone="lime"
              icon={<CalendarCheck className="size-4" aria-hidden />}
            />
            <StatCard
              label="Izin"
              value={summary.permit}
              hint="hari tidak bekerja"
              tone="sky"
              icon={<Clock className="size-4" aria-hidden />}
            />
            <StatCard
              label="Sakit"
              value={summary.sick}
              hint="hari tidak bekerja"
              tone="peach"
              icon={<HeartPulse className="size-4" aria-hidden />}
            />
            <StatCard
              label="Alpa"
              value={summary.absent}
              hint="hari kerja tanpa absen"
              tone="light"
              icon={<CircleSlash className="size-4" aria-hidden />}
            />
          </div>

          <Card>
            <CardTitle
              title="Aktivitas terbaru"
              action={
                <ButtonLink href="/aktivitas" variant="soft" className="px-4 py-2">
                  Semua
                </ButtonLink>
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                title="Belum ada aktivitas"
                description="Aktivitas muncul setelah Anda absen dan mencatat pekerjaan."
              />
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{a.title}</p>
                      <p className="text-xs text-muted">{formatDate(a.date)}</p>
                    </div>
                    <Badge tone={activityLabel[a.type].tone}>
                      {activityLabel[a.type].label}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-6 self-start">
          <CardTitle title="Periode magang" />
          {active ? (
            <>
              <p className="text-lg font-bold">{active.team.name}</p>
              <div className="mt-1">
                <Badge tone={internshipTypeInfo[active.type].tone}>
                  {internshipTypeInfo[active.type].label}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {formatDate(active.startDate)} – {formatDate(active.endDate)}
              </p>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-sm font-semibold">
                  <span>Progres</span>
                  <span>{percent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-3 overflow-hidden rounded-full bg-canvas"
                >
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Hari ke-{elapsed} dari {total} hari
                </p>
              </div>
            </>
          ) : pending ? (
            <div className="space-y-2">
              <Badge tone={registrationLabel.PENDING.tone}>Menunggu persetujuan</Badge>
              <p className="text-sm font-semibold">{pending.team.name}</p>
              <p className="text-sm text-muted">
                {formatDate(pending.startDate)} – {formatDate(pending.endDate)}
              </p>
            </div>
          ) : (
            <EmptyState
              title="Belum ada periode aktif"
              description="Ajukan pendaftaran dengan tanggal mulai dan selesai."
            />
          )}
        </Card>
      </div>
    </>
  );
}
