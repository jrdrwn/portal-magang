import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, UserCheck, UserX, Users } from "lucide-react";
import { requireAdmin, teamScope } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  addDays,
  dateToKey,
  formatDate,
  formatTime,
  formatWeekday,
  todayDate,
} from "@/lib/dates";
import { attendanceLabel } from "@/lib/labels";
import { getActiveInterns, internInTeam } from "@/lib/queries";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui/ui";

export const metadata: Metadata = { title: "Ringkasan Admin" };

export default async function AdminHome() {
  const admin = await requireAdmin();
  const scope = teamScope(admin);
  const regScope = scope ? { teamId: scope } : {};
  const today = todayDate();
  const weekStart = addDays(today, -6);

  const [interns, todays, pendingCount, pendingList, weekRows] = await Promise.all([
    getActiveInterns(today, scope),
    db.attendance.findMany({
      where: { date: today, ...(scope ? { user: internInTeam(scope) } : {}) },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.registration.count({ where: { status: "PENDING", ...regScope } }),
    db.registration.findMany({
      where: { status: "PENDING", ...regScope },
      include: {
        user: { select: { name: true } },
        team: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    db.attendance.groupBy({
      by: ["date", "status"],
      where: {
        date: { gte: weekStart, lte: today },
        ...(scope ? { user: internInTeam(scope) } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const activeIds = new Set(interns.map((i) => i.id));
  const todaysActive = todays.filter((t) => activeIds.has(t.userId));
  const attended = new Set(todaysActive.map((t) => t.userId));
  const notYet = interns.filter((i) => !attended.has(i.id));
  const count = (s: string) => todaysActive.filter((t) => t.status === s).length;
  const present = count("PRESENT") + count("LATE");
  const away = count("PERMIT") + count("SICK");

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const chart = days.map((d) => {
    const key = dateToKey(d);
    const n = (statuses: string[]) =>
      weekRows
        .filter((r) => dateToKey(r.date) === key && statuses.includes(r.status))
        .reduce((sum, r) => sum + r._count._all, 0);
    return { d, present: n(["PRESENT", "LATE"]), away: n(["PERMIT", "SICK"]) };
  });
  const max = Math.max(1, ...chart.map((c) => c.present + c.away));

  return (
    <>
      <PageHeader
        title={admin.role === "TEAM_ADMIN" ? `Ringkasan · ${admin.teamName ?? "Tanpa tim"}` : "Ringkasan"}
        description={`${formatWeekday(today)}, ${formatDate(today, "long")}`}
        action={<ButtonLink href="/admin/absensi">Monitor absensi</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Peserta aktif"
          value={interns.length}
          hint="periode magang berjalan"
          tone="dark"
          icon={<Users className="size-4" aria-hidden />}
        />
        <StatCard
          label="Bekerja hari ini"
          value={present}
          hint={`${count("LATE")} terlambat`}
          tone="lime"
          icon={<UserCheck className="size-4" aria-hidden />}
        />
        <StatCard
          label="Izin / sakit"
          value={away}
          hint="tidak bekerja"
          tone="sky"
          icon={<CalendarClock className="size-4" aria-hidden />}
        />
        <StatCard
          label="Belum absen"
          value={notYet.length}
          hint={`${pendingCount} pendaftaran menunggu`}
          tone="peach"
          icon={<UserX className="size-4" aria-hidden />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardTitle title="Kehadiran 7 hari terakhir" hint="Hadir/terlambat dan izin/sakit" />
            <div className="flex h-48 items-end gap-3">
              {chart.map((c) => (
                <div key={dateToKey(c.d)} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div
                    className="flex w-full max-w-12 flex-col justify-end overflow-hidden rounded-2xl bg-canvas"
                    style={{ height: `${Math.max(8, ((c.present + c.away) / max) * 100)}%` }}
                    title={`${c.present} hadir, ${c.away} izin/sakit`}
                  >
                    <div className="bg-sky" style={{ flexGrow: c.away }} />
                    <div className="bg-brand-600" style={{ flexGrow: c.present }} />
                  </div>
                  <span className="text-[11px] font-semibold text-muted">
                    {formatWeekday(c.d).slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <i className="size-2.5 rounded-full bg-brand-600" /> Hadir
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2.5 rounded-full bg-sky" /> Izin/sakit
              </span>
            </div>
          </Card>

          <Card>
            <CardTitle
              title="Absen terbaru hari ini"
              action={
                <ButtonLink href="/admin/absensi" variant="soft" className="px-4 py-2">
                  Semua
                </ButtonLink>
              }
            />
            {todays.length === 0 ? (
              <EmptyState title="Belum ada yang absen" description="Data muncul saat peserta mulai absen." />
            ) : (
              <ul className="divide-y divide-line">
                {todays.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={t.user.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{t.user.name}</p>
                        <p className="text-xs text-muted">
                          {t.checkInAt ? `Masuk ${formatTime(t.checkInAt)}` : (t.note ?? "-")}
                        </p>
                      </div>
                    </div>
                    <Badge tone={attendanceLabel[t.status].tone}>
                      {attendanceLabel[t.status].label}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="h-fit space-y-6 xl:sticky xl:top-6 self-start">
          <Card>
            <CardTitle
              title="Pendaftaran menunggu"
              hint={`${pendingCount} perlu ditinjau`}
              action={
                <ButtonLink href="/admin/pendaftaran" variant="soft" className="px-4 py-2">
                  Tinjau
                </ButtonLink>
              }
            />
            {pendingList.length === 0 ? (
              <EmptyState title="Semua sudah ditinjau" />
            ) : (
              <ul className="space-y-2">
                {pendingList.map((r) => (
                  <li key={r.id} className="rounded-3xl bg-canvas/70 p-4">
                    <p className="font-semibold">{r.user.name}</p>
                    <p className="text-xs text-muted">
                      {r.team.name} · {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle title="Belum absen hari ini" hint={`${notYet.length} peserta`} />
            {notYet.length === 0 ? (
              <EmptyState title="Semua peserta aktif sudah tercatat" />
            ) : (
              <ul className="space-y-2">
                {notYet.slice(0, 8).map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/admin/peserta/${i.id}`}
                      className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-canvas"
                    >
                      <Avatar name={i.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{i.name}</span>
                        <span className="block text-xs text-muted">{i.team}</span>
                      </span>
                    </Link>
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
