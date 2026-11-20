import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { correctAttendance } from "@/actions/correction";
import { ActionForm, ComboboxField, Field } from "@/components/ui/form";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui/ui";
import { requireAdmin, teamScope } from "@/lib/auth";
import { dayKind, getCalendar } from "@/lib/calendar";
import { db } from "@/lib/db";
import { formatDate, formatTime, formatWeekday, isValidDateKey, keyToDate, todayDate } from "@/lib/dates";
import { formatDistance } from "@/lib/geo";
import { attendanceLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Koreksi absensi" };

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Hadir", description: "Tepat waktu" },
  { value: "LATE", label: "Terlambat", description: "Masuk setelah batas terlambat" },
  { value: "PERMIT", label: "Izin", description: "Tidak bekerja, dengan keterangan" },
  { value: "SICK", label: "Sakit", description: "Tidak bekerja, dengan keterangan" },
  { value: "ABSENT", label: "Alpa", description: "Hapus catatan hari ini" },
];

export default async function CorrectionPage({ params }: PageProps<"/admin/peserta/[id]/koreksi/[date]">) {
  const admin = await requireAdmin();
  const scope = teamScope(admin);
  const { id, date: dateKey } = await params;
  if (!isValidDateKey(dateKey)) notFound();
  const date = keyToDate(dateKey);
  if (date > todayDate()) notFound();

  const reg = await db.registration.findFirst({
    where: {
      userId: id,
      status: "APPROVED",
      startDate: { lte: date },
      endDate: { gte: date },
      ...(scope ? { teamId: scope } : {}),
    },
    include: { user: { select: { name: true, email: true } }, team: { select: { name: true } } },
  });
  if (!reg) notFound();

  const [att, cal] = await Promise.all([
    db.attendance.findUnique({
      where: { userId_date: { userId: id, date } },
      include: { correctedBy: { select: { name: true } } },
    }),
    getCalendar(date, date),
  ]);
  const kind = dayKind(date, cal);
  const hhmm = (d: Date | null | undefined) => (d ? formatTime(d) : "");

  return (
    <>
      <Link
        href={`/admin/peserta/${id}`}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> {reg.user.name}
      </Link>
      <PageHeader
        title="Koreksi absensi"
        description={`${reg.user.name} · tim ${reg.team.name} · ${formatWeekday(date)}, ${formatDate(date, "long")}`}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardTitle title="Data baru" hint="Jam memakai zona waktu WIB." />
          <ActionForm action={correctAttendance.bind(null, id, dateKey)} submitLabel="Simpan koreksi" variant="brand">
            <ComboboxField
              label="Status"
              name="status"
              defaultValue={att?.status ?? "PRESENT"}
              options={STATUS_OPTIONS}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jam masuk" name="checkIn" type="time" defaultValue={hhmm(att?.checkInAt)} hint="Untuk Hadir/Terlambat" />
              <Field label="Jam pulang (opsional)" name="checkOut" type="time" defaultValue={hhmm(att?.checkOutAt)} />
            </div>
            <Field
              label="Keterangan izin/sakit"
              name="note"
              as="textarea"
              rows={2}
              maxLength={500}
              defaultValue={att?.status === "PERMIT" || att?.status === "SICK" ? (att.note ?? "") : ""}
              hint="Wajib untuk Izin/Sakit"
            />
            <Field
              label="Alasan koreksi"
              name="reason"
              as="textarea"
              rows={2}
              maxLength={500}
              placeholder="Contoh: lupa absen pulang, sudah dikonfirmasi mentor"
              hint="Tercatat di log admin dan dikirim ke peserta."
            />
          </ActionForm>
        </Card>

        <Card className="h-fit self-start xl:sticky xl:top-6">
          <CardTitle title="Data saat ini" />
          {kind.type !== "work" ? (
            <p className="mb-3 rounded-2xl bg-peach p-3 text-sm">
              {kind.type === "holiday" ? `Hari libur: ${kind.name}.` : "Bukan hari kerja."} Tetap bisa dikoreksi bila peserta
              memang bekerja.
            </p>
          ) : null}
          {att ? (
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd>
                  <Badge tone={attendanceLabel[att.status].tone}>{attendanceLabel[att.status].label}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Masuk</dt>
                <dd className="font-semibold">{formatTime(att.checkInAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Pulang</dt>
                <dd className="font-semibold">{formatTime(att.checkOutAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Jarak masuk</dt>
                <dd>{att.checkInDistance != null ? formatDistance(att.checkInDistance) : "-"}</dd>
              </div>
              {att.note ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Keterangan</dt>
                  <dd className="text-right">{att.note}</dd>
                </div>
              ) : null}
              {att.correctedAt ? (
                <p className="rounded-2xl bg-brand-50 p-3 text-xs">
                  Terakhir dikoreksi {att.correctedBy?.name ?? "admin"}: {att.correctionReason}
                </p>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-muted">Belum ada catatan (alpa).</p>
          )}
        </Card>
      </div>
    </>
  );
}
