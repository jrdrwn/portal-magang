import type { Metadata } from "next";
import { createTeam, deleteTeam, setTeamOpen, updateTeam } from "@/actions/teams";
import { ActionButton, ActionForm, CheckboxField, Field } from "@/components/ui/form";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Tim" };

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
        <Card className="h-fit">
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
            <CheckboxField
              label="Buka pendaftaran"
              name="isOpen"
              defaultChecked
              hint="Tim langsung tampil di halaman pendaftaran."
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
                      <Badge tone={t.isOpen ? "success" : "neutral"}>
                        {t.isOpen ? "Pendaftaran dibuka" : "Ditutup"}
                      </Badge>
                    </div>
                    {t.description ? (
                      <p className="mt-1 text-sm text-muted">{t.description}</p>
                    ) : null}
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
                    <p className="text-xl font-bold">{n(active, t.id)}</p>
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
