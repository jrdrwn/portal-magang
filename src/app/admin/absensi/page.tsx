import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Camera, ChevronLeft, ChevronRight, Download, ExternalLink, PencilLine } from "lucide-react";
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
import { requireAdmin, teamScope } from "@/lib/auth";
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
import { getActiveInterns, internInTeam } from "@/lib/queries";
import { dayKind, getCalendar } from "@/lib/calendar";

export const metadata: Metadata = { title: "Monitor absensi" };

export default async function AdminAttendance({ searchParams }: PageProps<"/admin/absensi">) {
  const admin = await requireAdmin();
  const scope = teamScope(admin);
  const sp = await searchParams;
  const raw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const today = todayDate();
  const date = isValidDateKey(raw) ? keyToDate(raw) : today;
  const isFuture = date > today;
  const isToday = dateToKey(date) === dateToKey(today);

  const [interns, records, cal] = await Promise.all([
    getActiveInterns(date, scope),
    db.attendance.findMany({
      where: { date, ...(scope ? { user: internInTeam(scope) } : {}) },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ checkInAt: "asc" }, { createdAt: "asc" }],
    }),
    getCalendar(date, date),
  ]);
  const kind = dayKind(date, cal);
  const workday = kind.type === "work";

  const byUser = new Map(records.map((r) => [r.userId, r]));
  const missing = interns.filter((i) => !byUser.has(i.id));
  const count = (s: string) => records.filter((r) => r.status === s).length;

  type Row = {
    attId: string | null;
    inPhoto: boolean;
    outPhoto: boolean;
    corrected: boolean;
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
      attId: r.id,
      inPhoto: Boolean(r.checkInPhotoKey),
      outPhoto: Boolean(r.checkOutPhotoKey),
      corrected: Boolean(r.correctedAt),
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
    ...(isFuture || !workday
      ? []
      : missing.map((i) => ({
          attId: null,
          inPhoto: false,
          outPhoto: false,
          corrected: false,
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
          value={isFuture || !workday ? 0 : missing.length}
          hint={workday ? undefined : kind.type === "holiday" ? kind.name : "Bukan hari kerja"}
          tone="dark"
        />
      </div>

      {!workday ? (
        <p className="mb-6 rounded-3xl bg-sky px-5 py-4 text-sm font-medium text-[#1c4a8a]">
          {kind.type === "holiday" ? `Hari libur: ${kind.name}.` : "Bukan hari kerja."} Peserta tanpa catatan tidak dihitung alpa.
        </p>
      ) : null}

      <Card className="mb-6">
        <form
          action="/admin/export/absensi"
          method="get"
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <p className="text-sm font-semibold">Export rekap absensi (CSV)</p>
            <p className="text-xs text-muted">Maksimal 93 hari. Bisa dibuka di Excel / Google Sheets.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-muted">
              Dari
              <input
                type="date"
                name="from"
                required
                defaultValue={`${dateToKey(date).slice(0, 7)}-01`}
                className={clsx(inputClass, "mt-1 w-auto py-2")}
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Sampai
              <input
                type="date"
                name="to"
                required
                defaultValue={dateToKey(date)}
                className={clsx(inputClass, "mt-1 w-auto py-2")}
              />
            </label>
            <button type="submit" className={clsx(btn.base, btn.soft, "py-2.5")}>
              <Download className="size-4" aria-hidden />
              Unduh CSV
            </button>
          </div>
        </form>
      </Card>

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
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-canvas/50">
                  <Td primary>
                    <Link href={`/admin/peserta/${r.id}`} className="flex items-center gap-3 hover:underline">
                      <Avatar name={r.name} size="sm" />
                      <span>
                        <span className="block font-semibold">{r.name}</span>
                        <span className="block text-xs text-muted">{r.sub}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td label="Status">
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={r.status.tone}>{r.status.label}</Badge>
                      {r.corrected ? <Badge tone="brand">Dikoreksi</Badge> : null}
                    </span>
                  </Td>
                  <Td label="Masuk" className="whitespace-nowrap">
                    {formatTime(r.checkIn)}
                    {r.inPhoto && r.attId ? (
                      <a href={`/api/berkas/absen/${r.attId}/masuk`} target="_blank" rel="noreferrer" aria-label={`Swafoto masuk ${r.name}`} className="ml-1.5 inline-flex align-middle text-brand-600">
                        <Camera className="size-4" aria-hidden />
                      </a>
                    ) : null}
                  </Td>
                  <Td label="Pulang" className="whitespace-nowrap">
                    {formatTime(r.checkOut)}
                    {r.outPhoto && r.attId ? (
                      <a href={`/api/berkas/absen/${r.attId}/pulang`} target="_blank" rel="noreferrer" aria-label={`Swafoto pulang ${r.name}`} className="ml-1.5 inline-flex align-middle text-brand-600">
                        <Camera className="size-4" aria-hidden />
                      </a>
                    ) : null}
                  </Td>
                  <Td label="Jarak">{r.distance != null ? formatDistance(r.distance) : "-"}</Td>
                  <Td label="Keterangan">
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
                  <Td actions className="text-right">
                    {!isFuture ? (
                      <Link
                        href={`/admin/peserta/${r.id}/koreksi/${dateToKey(date)}`}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                      >
                        <PencilLine className="size-3.5" aria-hidden /> Koreksi
                      </Link>
                    ) : null}
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
