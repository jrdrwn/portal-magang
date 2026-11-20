import type { Metadata } from "next";
import { changePassword, updateAccountName } from "@/actions/profile";
import { ActionForm, Field } from "@/components/ui/form";
import { Avatar, Badge, Card, CardTitle, PageHeader } from "@/components/ui/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReminderSettings } from "@/components/reminder-settings";
import { vapidPublicKey } from "@/lib/push";
import { roleLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Akun saya" };

export default async function MyAccountPage() {
  const user = await requireAdmin();
  const account = await db.user.findUnique({ where: { id: user.id }, select: { reminders: true } });

  return (
    <>
      <PageHeader title="Akun saya" description="Ubah nama tampilan dan password Anda." />

      <div className="grid gap-6 xl:grid-cols-[320px_1fr_1fr]">
        <Card className="flex flex-col items-center text-center">
          <Avatar name={user.name} size="lg" />
          <p className="mt-4 text-lg font-bold">{user.name}</p>
          <p className="text-sm text-muted">{user.email}</p>
          <div className="mt-3">
            <Badge tone={user.role === "SUPER_ADMIN" ? "brand" : "info"}>
              {roleLabel[user.role]}
              {user.role === "TEAM_ADMIN" ? ` · ${user.teamName ?? "tanpa tim"}` : ""}
            </Badge>
          </div>
        </Card>

        <Card className="h-fit">
          <CardTitle title="Nama tampilan" />
          <ActionForm action={updateAccountName} submitLabel="Simpan" idPrefix="name-">
            <Field label="Nama" name="name" defaultValue={user.name} maxLength={80} />
          </ActionForm>
        </Card>

        <Card className="h-fit">
          <CardTitle title="Ganti password" hint="Sesi di perangkat lain akan otomatis keluar." />
          <ActionForm action={changePassword} submitLabel="Ganti password" variant="brand" resetOnSuccess>
            <Field label="Password saat ini" name="current" type="password" autoComplete="current-password" />
            <Field
              label="Password baru"
              name="next"
              type="password"
              autoComplete="new-password"
              hint="Minimal 8 karakter"
            />
            <Field label="Ulangi password baru" name="confirm" type="password" autoComplete="new-password" />
          </ActionForm>
        </Card>

        <Card className="h-fit xl:col-span-2 xl:col-start-2">
          <CardTitle title="Pengingat & notifikasi" hint="Kabar pendaftaran baru, laporan izin/sakit, dan pengingat harian." />
          <ReminderSettings
            vapidKey={vapidPublicKey()}
            remindersEnabled={account?.reminders ?? true}
            showDailyToggle
            workStart=""
            workEnd=""
            dailyDescription="Pendaftaran menunggu, peserta yang belum absen 30 menit setelah batas terlambat, dan evaluasi bulanan yang belum diisi (akhir & awal bulan)."
          />
        </Card>
      </div>
    </>
  );
}
