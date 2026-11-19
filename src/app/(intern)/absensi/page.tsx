import type { Metadata } from "next";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { submitAbsence } from "@/actions/attendance";
import { AttendancePanel } from "@/components/attendance-panel";
import { ActionForm, ComboboxField, Field } from "@/components/ui/form";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  Table,
  Td,
  Th,
} from "@/components/ui/ui";
import { requireIntern } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatTime, todayDate } from "@/lib/dates";
import { formatDistance, mapsUrl } from "@/lib/geo";
import { attendanceLabel } from "@/lib/labels";
import { getActiveRegistration, getOfficeSetting } from "@/lib/queries";

export const metadata: Metadata = { title: "Absensi" };

export default function AttendancePage() {
  return (
    <Suspense fallback={<AttendanceSkeleton />}>
      <AttendanceContent />
    </Suspense>
  );
}

function AttendanceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat absensi">
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="h-[30rem] animate-pulse rounded-card bg-ink/90" />
        <div className="h-80 animate-pulse rounded-card bg-surface" />
      </div>
      <div className="mt-6 h-64 animate-pulse rounded-card bg-surface" />
    </div>
  );
}

async function AttendanceContent() {
  const user = await requireIntern();
  const today = todayDate();

  const [office, active, attendance, history] = await Promise.all([
    getOfficeSetting(),
    getActiveRegistration(user.id, today),
    db.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    }),
    db.attendance.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 31,
    }),
  ]);

  let mode: "checkin" | "checkout" | "done" | "blocked" = "checkin";
  let blockedReason: string | undefined;
  if (!active) {
    mode = "blocked";
    blockedReason =
      "Anda belum memiliki periode magang aktif hari ini. Absen aktif setelah pendaftaran disetujui dan tanggal mulai tiba.";
  } else if (attendance?.status === "PERMIT" || attendance?.status === "SICK") {
    mode = "blocked";
    blockedReason = `Hari ini Anda tercatat ${attendanceLabel[attendance.status].label.toLowerCase()} (tidak bekerja). Absen lokasi tidak diperlukan.`;
  } else if (attendance?.checkOutAt) {
    mode = "done";
  } else if (attendance) {
    mode = "checkout";
  }

  const canReportAbsence = Boolean(active) && !attendance;

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <AttendancePanel
          office={{
            name: office.name,
            latitude: office.latitude,
            longitude: office.longitude,
            radiusMeters: office.radiusMeters,
            workStart: office.workStart,
            lateAfter: office.lateAfter,
            workEnd: office.workEnd,
          }}
          mode={mode}
          blockedReason={blockedReason}
          checkInTime={attendance?.checkInAt ? formatTime(attendance.checkInAt) : undefined}
          checkOutTime={attendance?.checkOutAt ? formatTime(attendance.checkOutAt) : undefined}
        />

        {canReportAbsence ? (
          <Card className="h-fit xl:sticky xl:top-6 self-start">
            <CardTitle
              title="Tidak bisa bekerja hari ini?"
              hint="Laporkan izin atau sakit. Tercatat sebagai aktivitas tidak bekerja."
            />
            <ActionForm action={submitAbsence} submitLabel="Kirim laporan" resetOnSuccess>
              <ComboboxField
                label="Jenis"
                name="kind"
                defaultValue="PERMIT"
                options={[
                  { value: "PERMIT", label: "Izin", description: "Keperluan pribadi/keluarga, urusan kampus" },
                  { value: "SICK", label: "Sakit", description: "Tidak dalam kondisi sehat untuk bekerja" },
                ]}
              />
              <Field
                label="Alasan"
                name="note"
                as="textarea"
                placeholder="Contoh: ada keperluan keluarga"
              />
            </ActionForm>
          </Card>
        ) : null}
      </div>

      <Card className="mt-6">
        <CardTitle title="Riwayat absensi" hint="31 catatan terakhir" />
        {history.length === 0 ? (
          <EmptyState
            title="Belum ada riwayat"
            description="Riwayat kehadiran Anda akan tampil di sini."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>Status</Th>
                <Th>Masuk</Th>
                <Th>Pulang</Th>
                <Th>Jarak masuk</Th>
                <Th>Lokasi</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
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
                    {a.checkInDistance != null
                      ? formatDistance(a.checkInDistance)
                      : (a.note ?? "-")}
                  </Td>
                  <Td>
                    {a.checkInLat != null && a.checkInLng != null ? (
                      <a
                        href={mapsUrl(a.checkInLat, a.checkInLng)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"
                      >
                        Peta <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      "-"
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
