import type { Metadata } from "next";
import { createTeam, deleteTeam, setTeamOpen, updateTeam } from "@/actions/teams";
import { ActionButton, ActionForm, CheckboxField, Field } from "@/components/ui/form";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateToKey, formatDate, todayDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Tim" };

function openState(t: { isOpen: boolean; regOpensAt: Date | null; regClosesAt: Date | null }) {
  const today = todayDate();
  if (!t.isOpen) return { label: "Ditutup", tone: "neutral" as const };
  if (t.regOpensAt && t.regOpensAt > today) return { label: `Dibuka ${formatDate(t.regOpensAt)}`, tone: "info" as const };
  if (t.regClosesAt && t.regClosesAt < today) return { label: "Lewat jadwal", tone: "warning" as const };
  return { label: "Pendaftaran dibuka", tone: "success" as const };
}

function ScheduleFields({ quota, opensAt = "", closesAt = "" }: { quota?: number | null; opensAt?: string; closesAt?: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Buka pendaftaran" name="regOpensAt" type="date" defaultValue={opensAt} hint="Kosong = mulai sekarang" />
        <Field label="Tutup pendaftaran" name="regClosesAt" type="date" defaultValue={closesAt} hint="Kosong = tanpa batas" />
      </div>
      <Field
        label="Kuota peserta"
        name="quota"
        type="number"
        min={1}
        max={500}
        inputMode="numeric"
        defaultValue={quota != null ? String(quota) : ""}
        hint="Maks. peserta disetujui yang periodenya bersamaan. Kosong = tanpa batas."
      />
    </>
  );
}

export default async function TeamsPage() {
  await requireSuperAdmin();
  const today = todayDate();

  const teams = await db.team.findMany({
    orderBy: { name: "asc" },
    include: {
      admins: { select: { id: true, name: true, isActive: true }, orderBy: { name: "asc" } },
      _count: { select: { registrations: true } },
    },
  });
  const [active, pending] = await Promise.all([
    db.registration.groupBy({
      by: ["teamId"],
      where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
      _count: { _all: true },
    }),
    db.registration.groupBy({
      by: ["teamId"],
      where: { status: "PENDING" },
      _count: { _all: true },
    }),
  ]);
  const n = (rows: typeof active, id: string) =>
    rows.find((r) => r.teamId === id)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        title="Tim"
        description="Tim yang dibuka tampil di halaman awal dan bisa dipilih saat pendaftaran."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="h-fit xl:sticky xl:top-6 self-start">
          <CardTitle title="Buat tim baru" />
          <ActionForm action={createTeam} submitLabel="Buat tim" variant="brand" resetOnSuccess idPrefix="new-">
            <Field label="Nama tim" name="name" placeholder="Contoh: Data Analyst" maxLength={60} />
            <Field
              label="Deskripsi (opsional)"
              name="description"
              as="textarea"
              rows={3}
              maxLength={300}
              placeholder="Tampil ke calon peserta saat memilih tim"
            />
            <ScheduleFields />
            <CheckboxField
              label="Buka pendaftaran"
              name="isOpen"
              defaultChecked
              hint="Tim tampil di halaman pendaftaran selama dalam jadwal."
            />
          </ActionForm>
        </Card>

        <div className="space-y-4">
          {teams.length === 0 ? (
            <Card>
              <EmptyState title="Belum ada tim" description="Buat tim pertama di samping." />
            </Card>
          ) : (
            teams.map((t) => (
              <Card key={t.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold">{t.name}</h2>
                      <Badge tone={openState(t).tone}>{openState(t).label}</Badge>
                    </div>
                    {t.description ? (
                      <p className="mt-1 text-sm text-muted">{t.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted">
                      Jadwal: {t.regOpensAt ? formatDate(t.regOpensAt) : "kapan saja"} s.d.{" "}
                      {t.regClosesAt ? formatDate(t.regClosesAt) : "tanpa batas"} · Kuota:{" "}
                      {t.quota != null ? `${t.quota} peserta` : "tanpa batas"}
                    </p>
                  </div>
                  <ActionButton
                    action={setTeamOpen.bind(null, t.id, !t.isOpen)}
                    variant={t.isOpen ? "ghost" : "brand"}
                  >
                    {t.isOpen ? "Tutup pendaftaran" : "Buka pendaftaran"}
                  </ActionButton>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-lime/50 p-3">
                    <p className="text-xl font-bold">
                      {n(active, t.id)}
                      {t.quota != null ? <span className="text-sm font-semibold text-ink/60">/{t.quota}</span> : null}
                    </p>
                    <p className="text-xs text-ink/70">Peserta aktif</p>
                  </div>
                  <div className="rounded-2xl bg-peach p-3">
                    <p className="text-xl font-bold">{n(pending, t.id)}</p>
                    <p className="text-xs text-ink/70">Menunggu</p>
                  </div>
                  <div className="rounded-2xl bg-sky p-3">
                    <p className="text-xl font-bold">{t.admins.length}</p>
                    <p className="text-xs text-ink/70">Admin tim</p>
                  </div>
                </div>

                <p className="mt-3 text-sm text-muted">
                  Admin:{" "}
                  {t.admins.length
                    ? t.admins.map((a) => a.name + (a.isActive ? "" : " (nonaktif)")).join(", ")
                    : "belum ada, tambahkan di menu Akun admin"}
                </p>

                <details className="group mt-4 rounded-3xl bg-canvas/70 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-700">
                    Edit tim
                  </summary>
                  <div className="mt-4">
                    <ActionForm
                      action={updateTeam.bind(null, t.id)}
                      submitLabel="Simpan"
                      idPrefix={`t-${t.id}-`}
                      extra={
                        t._count.registrations === 0 ? (
                          <ActionButton
                            action={deleteTeam.bind(null, t.id)}
                            variant="danger"
                            confirmText={`Hapus tim "${t.name}"?`}
                          >
                            Hapus tim
                          </ActionButton>
                        ) : null
                      }
                    >
                      <Field label="Nama tim" name="name" defaultValue={t.name} maxLength={60} />
                      <Field
                        label="Deskripsi"
                        name="description"
                        as="textarea"
                        rows={2}
                        maxLength={300}
                        defaultValue={t.description ?? ""}
                      />
                      <ScheduleFields
                        quota={t.quota}
                        opensAt={t.regOpensAt ? dateToKey(t.regOpensAt) : ""}
                        closesAt={t.regClosesAt ? dateToKey(t.regClosesAt) : ""}
                      />
                      <CheckboxField label="Buka pendaftaran" name="isOpen" defaultChecked={t.isOpen} />
                    </ActionForm>
                  </div>
                </details>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
