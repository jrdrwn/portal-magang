import Link from "next/link";
import { Camera, ExternalLink, PencilLine } from "lucide-react";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui/ui";
import { dayStatusLabel, type attendanceDays } from "@/lib/calendar";
import { formatDate, formatTime, formatWeekday } from "@/lib/dates";
import { formatDistance, mapsUrl } from "@/lib/geo";
import { attendanceLabel, type Tone } from "@/lib/labels";

type Row = Awaited<ReturnType<typeof attendanceDays>>["rows"][number];

const extraTone: Record<keyof typeof dayStatusLabel, Tone> = {
  ABSENT: "danger",
  HOLIDAY: "neutral",
  OFF: "neutral",
  PENDING: "neutral",
};

function StatusBadge({ row }: { row: Row }) {
  if (row.status in attendanceLabel) {
    const l = attendanceLabel[row.status as keyof typeof attendanceLabel];
    return <Badge tone={l.tone}>{l.label}</Badge>;
  }
  const k = row.status as keyof typeof dayStatusLabel;
  return <Badge tone={extraTone[k]}>{dayStatusLabel[k]}</Badge>;
}

/** Tabel absensi harian: termasuk alpa & libur. `correctBase` = tautan koreksi untuk admin. */
export function AttendanceDays({
  rows,
  correctBase,
  maxHeight = true,
}: {
  rows: Row[];
  correctBase?: string;
  maxHeight?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState title="Belum ada riwayat" description="Riwayat kehadiran tampil setelah periode magang dimulai." />;
  }
  return (
    <Table className={maxHeight ? "max-h-[28rem] overflow-y-auto" : undefined}>
      <thead>
        <tr>
          <Th>Tanggal</Th>
          <Th>Status</Th>
          <Th>Masuk</Th>
          <Th>Pulang</Th>
          <Th>Lokasi</Th>
          <Th>Keterangan</Th>
          {correctBase ? <Th className="text-right">Aksi</Th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const a = r.att;
          const quiet = r.status === "HOLIDAY" || r.status === "OFF";
          return (
            <tr key={r.key} className={quiet ? "text-muted" : undefined}>
              <Td className="whitespace-nowrap">
                <span className="block font-medium">{formatDate(r.date)}</span>
                <span className="text-xs text-muted">{formatWeekday(r.date)}</span>
              </Td>
              <Td>
                <span className="flex flex-wrap items-center gap-1">
                  <StatusBadge row={r} />
                  {a?.correctedAt ? (
                    <span title={`Dikoreksi ${a.correctedBy?.name ?? "admin"}: ${a.correctionReason ?? ""}`}>
                      <Badge tone="brand">Dikoreksi</Badge>
                    </span>
                  ) : null}
                </span>
              </Td>
              <Td className="whitespace-nowrap">
                {formatTime(a?.checkInAt)}
                {a?.checkInPhotoKey ? (
                  <a
                    href={`/api/berkas/absen/${a.id}/masuk`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Lihat swafoto masuk"
                    className="ml-1.5 inline-flex align-middle text-brand-600"
                  >
                    <Camera className="size-4" aria-hidden />
                  </a>
                ) : null}
              </Td>
              <Td className="whitespace-nowrap">
                {formatTime(a?.checkOutAt)}
                {a?.checkOutPhotoKey ? (
                  <a
                    href={`/api/berkas/absen/${a.id}/pulang`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Lihat swafoto pulang"
                    className="ml-1.5 inline-flex align-middle text-brand-600"
                  >
                    <Camera className="size-4" aria-hidden />
                  </a>
                ) : null}
              </Td>
              <Td className="whitespace-nowrap">
                {a?.checkInLat != null && a.checkInLng != null ? (
                  <a
                    href={mapsUrl(a.checkInLat, a.checkInLng)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"
                  >
                    {a.checkInDistance != null ? formatDistance(a.checkInDistance) : "Peta"}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : (
                  "-"
                )}
              </Td>
              <Td className="text-sm">{r.holidayName ?? a?.note ?? "-"}</Td>
              {correctBase ? (
                <Td className="text-right">
                  {r.status !== "OFF" ? (
                    <Link
                      href={`${correctBase}/${r.key}`}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      <PencilLine className="size-3.5" aria-hidden /> Koreksi
                    </Link>
                  ) : null}
                </Td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
