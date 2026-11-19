import type { Metadata } from "next";
import { Briefcase, Coffee, MapPin } from "lucide-react";
import { addWorkActivity, deleteWorkActivity } from "@/actions/activity";
import { ActionButton, ActionForm, Field } from "@/components/ui/form";
import {
  Badge,
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/ui";
import { requireIntern } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateToKey, formatDate, formatTime, formatWeekday, todayDate } from "@/lib/dates";
import { activityLabel, attendanceLabel } from "@/lib/labels";
import { getActiveRegistration, getTodayAttendance } from "@/lib/queries";

export const metadata: Metadata = { title: "Aktivitas" };

export default async function ActivityPage() {
  const user = await requireIntern();
  const today = todayDate();

  const [active, attendance, activities] = await Promise.all([
    getActiveRegistration(user.id, today),
    getTodayAttendance(user.id, today),
    db.activity.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const groups = new Map<string, typeof activities>();
  for (const a of activities) {
    const key = dateToKey(a.date);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  const notWorking = attendance?.status === "PERMIT" || attendance?.status === "SICK";
  const working = attendance && !notWorking;
  const todayKey = dateToKey(today);

  return (
    <>
      <PageHeader
        title="Aktivitas"
        description="Catat apa yang Anda kerjakan. Status hari ini mengikuti absensi."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <Card
            className={
              working ? "bg-lime shadow-none" : notWorking ? "bg-sky shadow-none" : "bg-peach shadow-none"
            }
          >
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/70">
                {working ? (
                  <Briefcase className="size-5" aria-hidden />
                ) : notWorking ? (
                  <Coffee className="size-5" aria-hidden />
                ) : (
                  <MapPin className="size-5" aria-hidden />
                )}
              </span>
              <div>
                <p className="text-sm text-ink/60">
                  {formatWeekday(today)}, {formatDate(today)}
                </p>
                <p className="text-xl font-bold">
                  {!active
                    ? "Tidak ada periode magang aktif"
                    : working
                      ? `Bekerja${attendance.status === "LATE" ? " (terlambat)" : ""}`
                      : notWorking
                        ? `Tidak bekerja · ${attendanceLabel[attendance.status].label}`
                        : "Belum absen"}
                </p>
                <p className="mt-1 text-sm text-ink/70">
                  {!active
                    ? "Aktivitas bisa dicatat saat periode magang Anda berjalan."
                    : working
                      ? `Masuk pukul ${formatTime(attendance.checkInAt)}. Silakan catat pekerjaan Anda.`
                      : notWorking
                        ? (attendance.note ?? "Aktivitas kerja tidak perlu dicatat hari ini.")
                        : "Absen masuk dulu agar aktivitas bekerja bisa dicatat, atau laporkan izin/sakit."}
                </p>
                {active && !attendance ? (
                  <ButtonLink href="/absensi" className="mt-4">
                    Ke halaman absensi
                  </ButtonLink>
                ) : null}
              </div>
            </div>
          </Card>

          {working ? (
            <Card>
              <CardTitle title="Tambah aktivitas bekerja" />
              <ActionForm action={addWorkActivity} submitLabel="Simpan aktivitas" variant="brand" resetOnSuccess>
                <Field
                  label="Judul"
                  name="title"
                  placeholder="Contoh: Membuat halaman login"
                  maxLength={120}
                />
                <Field
                  label="Deskripsi (opsional)"
                  name="description"
                  as="textarea"
                  placeholder="Apa yang dikerjakan, hasil, kendala…"
                  maxLength={2000}
                />
              </ActionForm>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardTitle title="Riwayat aktivitas" hint="Dikelompokkan per tanggal" />
          {groups.size === 0 ? (
            <EmptyState
              title="Belum ada aktivitas"
              description="Aktivitas bekerja dan tidak bekerja Anda akan tampil di sini."
            />
          ) : (
            <div className="space-y-6">
              {[...groups.entries()].map(([key, items]) => (
                <div key={key}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                    {formatWeekday(items[0].date)}, {formatDate(items[0].date)}
                  </h3>
                  <ul className="space-y-2">
                    {items.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-start justify-between gap-3 rounded-3xl bg-canvas/70 p-4"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{a.title}</p>
                          {a.description ? (
                            <p className="mt-1 whitespace-pre-line text-sm text-muted">
                              {a.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Badge tone={activityLabel[a.type].tone}>
                            {activityLabel[a.type].label}
                          </Badge>
                          {a.type === "WORK" && key === todayKey ? (
                            <ActionButton
                              action={deleteWorkActivity.bind(null, a.id)}
                              variant="danger"
                              confirmText="Hapus aktivitas ini?"
                              className="px-3 py-1 text-xs"
                            >
                              Hapus
                            </ActionButton>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
