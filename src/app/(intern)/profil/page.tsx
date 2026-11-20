import type { Metadata } from "next";
import { changePassword, updateProfile } from "@/actions/profile";
import { ActionForm, ComboboxField, Field } from "@/components/ui/form";
import { Avatar, Card, CardTitle, PageHeader } from "@/components/ui/ui";
import { requireIntern } from "@/lib/auth";
import { ReminderSettings } from "@/components/reminder-settings";
import { vapidPublicKey } from "@/lib/push";
import { getOfficeSetting } from "@/lib/queries";
import { db } from "@/lib/db";
import { dateToKey, formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const current = await requireIntern();
  const user = await db.user.findUniqueOrThrow({
    where: { id: current.id },
    include: { profile: true },
  });
  const p = user.profile;
  const office = await getOfficeSetting();

  const [instRows, majorRows] = await Promise.all([
    db.profile.findMany({
      where: { institution: { not: null } },
      distinct: ["institution"],
      select: { institution: true },
      orderBy: { institution: "asc" },
      take: 200,
    }),
    db.profile.findMany({
      where: { major: { not: null } },
      distinct: ["major"],
      select: { major: true },
      orderBy: { major: "asc" },
      take: 200,
    }),
  ]);
  const institutions = instRows.map((r) => ({ value: r.institution!, label: r.institution! }));
  const majors = majorRows.map((r) => ({ value: r.major!, label: r.major! }));

  return (
    <>
      <PageHeader
        title="Profil"
        description="Data diri Anda dilihat oleh admin untuk keperluan magang."
      />

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="h-fit space-y-6 xl:sticky xl:top-6 self-start">
          <Card className="flex flex-col items-center text-center">
            <Avatar name={user.name} size="lg" />
            <p className="mt-4 text-lg font-bold">{user.name}</p>
            <p className="text-sm text-muted">{user.email}</p>
            <p className="mt-4 text-xs text-muted">
              Bergabung {formatDate(user.createdAt)}
            </p>
          </Card>

          <Card>
            <CardTitle title="Pengingat & notifikasi" />
            <ReminderSettings
              vapidKey={vapidPublicKey()}
              remindersEnabled={user.reminders}
              showDailyToggle
              workStart={office.workStart}
              workEnd={office.workEnd}
            />
          </Card>

          <Card>
            <CardTitle title="Ganti password" />
            <ActionForm action={changePassword} submitLabel="Ganti password" resetOnSuccess>
              <Field label="Password saat ini" name="current" type="password" autoComplete="current-password" />
              <Field label="Password baru" name="next" type="password" autoComplete="new-password" hint="Minimal 8 karakter" />
              <Field label="Ulangi password baru" name="confirm" type="password" autoComplete="new-password" />
            </ActionForm>
          </Card>
        </div>

        <Card>
          <CardTitle title="Data diri" />
          <ActionForm action={updateProfile} submitLabel="Simpan perubahan" variant="brand">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama lengkap" name="name" defaultValue={user.name} />
              <Field
                label="No. telepon"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={p?.phone ?? ""}
                placeholder="08xxxxxxxxxx"
              />
              <ComboboxField
                label="Sekolah / kampus"
                name="institution"
                mode="free"
                maxLength={120}
                placeholder="Ketik untuk mencari"
                defaultValue={p?.institution ?? ""}
                options={institutions}
              />
              <ComboboxField
                label="Jurusan"
                name="major"
                mode="free"
                maxLength={120}
                placeholder="Ketik untuk mencari"
                defaultValue={p?.major ?? ""}
                options={majors}
              />
              <Field label="NIM / NIS" name="studentId" defaultValue={p?.studentId ?? ""} />
              <Field
                label="Tanggal lahir"
                name="birthDate"
                type="date"
                defaultValue={p?.birthDate ? dateToKey(p.birthDate) : ""}
              />
            </div>
            <Field label="Alamat" name="address" as="textarea" rows={2} defaultValue={p?.address ?? ""} />
            <Field
              label="Bio singkat"
              name="bio"
              as="textarea"
              rows={3}
              defaultValue={p?.bio ?? ""}
              placeholder="Minat, keahlian, atau tujuan magang"
            />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
