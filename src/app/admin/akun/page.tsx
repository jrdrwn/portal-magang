import type { Metadata } from "next";
import { createAdmin, setAdminActive, setAdminTeam } from "@/actions/admins";
import { resetPassword } from "@/actions/password-reset";
import { ActionButton, ActionForm, ComboboxField, Field } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Akun admin" };

export default async function AdminAccountsPage() {
  const me = await requireSuperAdmin();

  const [admins, teams] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "TEAM_ADMIN"] } },
      include: { team: { select: { id: true, name: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    db.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const teamOptions = teams.map((t) => ({ value: t.id, label: t.name }));

  return (
    <>
      <PageHeader
        title="Akun admin"
        description="Admin utama mengelola semua tim. Admin tim hanya melihat dan menilai peserta di timnya."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="h-fit xl:sticky xl:top-6 self-start">
          <CardTitle title="Tambah admin" />
          {teams.length === 0 ? (
            <p className="mb-4 rounded-2xl bg-peach p-3 text-sm">
              Belum ada tim. Buat tim dulu untuk menambah admin tim.{" "}
              <ButtonLink href="/admin/tim" variant="soft" className="mt-2 px-3 py-1.5">
                Ke menu Tim
              </ButtonLink>
            </p>
          ) : null}
          <ActionForm action={createAdmin} submitLabel="Buat akun" variant="brand" resetOnSuccess>
            <Field label="Nama" name="name" autoComplete="off" />
            <Field label="Email" name="email" type="email" autoComplete="off" />
            <Field
              label="Password awal"
              name="password"
              type="password"
              autoComplete="new-password"
              hint="Minimal 8 karakter. Sampaikan ke admin yang bersangkutan."
            />
            <ComboboxField
              label="Peran"
              name="role"
              defaultValue="TEAM_ADMIN"
              options={[
                { value: "TEAM_ADMIN", label: "Admin tim", description: "Hanya melihat dan menilai peserta di timnya" },
                { value: "SUPER_ADMIN", label: "Admin utama", description: "Mengelola semua tim, akun, dan pengaturan" },
              ]}
            />
            <ComboboxField
              label="Tim"
              name="teamId"
              mode="search"
              placeholder="Cari tim…"
              hint="Wajib untuk admin tim. Diabaikan untuk admin utama."
              options={teamOptions}
            />
          </ActionForm>
        </Card>

        <Card>
          <CardTitle title="Daftar admin" hint={`${admins.length} akun`} />
          {admins.length === 0 ? (
            <EmptyState title="Belum ada admin" />
          ) : (
            <ul className="space-y-3">
              {admins.map((a) => (
                <li key={a.id} className="rounded-3xl bg-canvas/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={a.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {a.name} {a.id === me.id ? <span className="text-xs text-muted">(Anda)</span> : null}
                        </p>
                        <p className="truncate text-xs text-muted">{a.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={a.role === "SUPER_ADMIN" ? "brand" : "info"}>
                        {roleLabel[a.role]}
                        {a.role === "TEAM_ADMIN" ? ` · ${a.team?.name ?? "tanpa tim"}` : ""}
                      </Badge>
                      {!a.isActive ? <Badge tone="danger">Nonaktif</Badge> : null}
                    </div>
                  </div>

                  {a.id !== me.id ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      {a.role === "TEAM_ADMIN" && teams.length > 0 ? (
                        <ActionForm
                          action={setAdminTeam.bind(null, a.id)}
                          submitLabel="Pindah tim"
                          idPrefix={`a-${a.id}-`}
                          className="flex flex-wrap items-center gap-2 space-y-0! [&>div:last-child]:pt-0!"
                          submitClassName="px-4 py-2"
                        >
                          <Combobox
                            name="teamId"
                            mode="search"
                            ariaLabel={`Tim untuk ${a.name}`}
                            placeholder="Cari tim…"
                            defaultValue={a.teamId ?? ""}
                            options={teamOptions}
                            className="w-52"
                          />
                        </ActionForm>
                      ) : null}
                      <ActionButton
                        action={resetPassword.bind(null, a.id)}
                        variant="soft"
                        showSuccess
                        confirmText={`Reset password ${a.name}?`}
                      >
                        Reset password
                      </ActionButton>
                      <ActionButton
                        action={setAdminActive.bind(null, a.id, !a.isActive)}
                        variant={a.isActive ? "danger" : "primary"}
                        confirmText={a.isActive ? `Nonaktifkan ${a.name}?` : undefined}
                      >
                        {a.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </ActionButton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
