import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  btn,
  inputClass,
} from "@/components/ui/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  addDays,
  dateKey,
  dateToKey,
  formatDate,
  formatTime,
  formatWeekday,
  isValidDateKey,
  keyToDate,
  todayDate,
} from "@/lib/dates";
import { formatDistance, mapsUrl } from "@/lib/geo";
import { attendanceLabel, type Tone } from "@/lib/labels";
import { getActiveInterns } from "@/lib/queries";

export const metadata: Metadata = { title: "Monitor absensi" };

export default async function AdminAttendance({ searchParams }: PageProps<"/admin/absensi">) {
  await requireUser("ADMIN");
  const sp = await searchParams;
  const raw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const today = todayDate();
  const date = isValidDateKey(raw) ? keyToDate(raw) : today;
  const isFuture = date > today;
  const isToday = dateToKey(date) === dateToKey(today);

  const [interns, records] = await Promise.all([
    getActiveInterns(date),
    db.attendance.findMany({
      where: { date },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ checkInAt: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const byUser = new Map(records.map((r) => [r.userId, r]));
  const missing = interns.filter((i) => !byUser.has(i.id));
  const count = (s: string) => records.filter((r) => r.status === s).length;

  type Row = {
    id: string;
    name: string;
    sub: string;
    status: { label: string; tone: Tone };
    checkIn: Date | null;
    checkOut: Date | null;
    distance: number | null;
    lat: number | null;
    lng: number | null;
    note: string | null;
  };

  const rows: Row[] = [
    ...records.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      sub: r.user.email,
      status: attendanceLabel[r.status],
      checkIn: r.checkInAt,
      checkOut: r.checkOutAt,
      distance: r.checkInDistance,
      lat: r.checkInLat,
      lng: r.checkInLng,
      note: r.note,
    })),
    ...(isFuture
      ? []
      : missing.map((i) => ({
          id: i.id,
          name: i.name,
          sub: i.email,
          status: isToday
            ? { label: "Belum absen", tone: "neutral" as Tone }
            : { label: "Alpa", tone: "danger" as Tone },
          checkIn: null,
          checkOut: null,
          distance: null,
          lat: null,
          lng: null,
          note: null,
        }))),
  ];

  const prev = dateToKey(addDays(date, -1));
  const next = dateToKey(addDays(date, 1));

  return (
    <>
      <PageHeader
        title="Monitor absensi"
        description={`${formatWeekday(date)}, ${formatDate(date, "long")}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/absensi?date=${prev}`}
              aria-label="Hari sebelumnya"
              className="grid size-10 place-items-center rounded-full bg-surface shadow-card"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <form className="flex items-center gap-2">
              <label htmlFor="date" className="sr-only">
                Tanggal
              </label>
              <input
                id="date"
                type="date"
                name="date"
                defaultValue={dateToKey(date)}
                max={dateKey()}
                className={clsx(inputClass, "w-auto bg-surface py-2.5")}
              />
              <button type="submit" className={clsx(btn.base, btn.primary, "py-2.5")}>
                Lihat
              </button>
            </form>
            <Link
              href={`/admin/absensi?date=${next}`}
              aria-label="Hari berikutnya"
              className="grid size-10 place-items-center rounded-full bg-surface shadow-card"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Hadir" value={count("PRESENT")} tone="lime" />
        <StatCard label="Terlambat" value={count("LATE")} tone="peach" />
        <StatCard label="Izin / sakit" value={count("PERMIT") + count("SICK")} tone="sky" />
        <StatCard
          label={isToday ? "Belum absen" : "Alpa"}
          value={isFuture ? 0 : missing.length}
          tone="dark"
        />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="Tidak ada data"
            description="Tidak ada peserta aktif atau catatan absensi pada tanggal ini."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Peserta</Th>
                <Th>Status</Th>
                <Th>Masuk</Th>
                <Th>Pulang</Th>
                <Th>Jarak</Th>
                <Th>Keterangan</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-canvas/50">
                  <Td>
                    <Link href={`/admin/peserta/${r.id}`} className="flex items-center gap-3 hover:underline">
                      <Avatar name={r.name} size="sm" />
                      <span>
                        <span className="block font-semibold">{r.name}</span>
                        <span className="block text-xs text-muted">{r.sub}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={r.status.tone}>{r.status.label}</Badge>
                  </Td>
                  <Td>{formatTime(r.checkIn)}</Td>
                  <Td>{formatTime(r.checkOut)}</Td>
                  <Td>{r.distance != null ? formatDistance(r.distance) : "-"}</Td>
                  <Td>
                    {r.lat != null && r.lng != null ? (
                      <a
                        href={mapsUrl(r.lat, r.lng)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"
                      >
                        Lihat lokasi <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      (r.note ?? "-")
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
