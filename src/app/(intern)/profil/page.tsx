import type { Metadata } from "next";
import { changePassword, updateProfile } from "@/actions/profile";
import { ActionForm, Field } from "@/components/ui/form";
import { Avatar, Card, CardTitle, PageHeader } from "@/components/ui/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateToKey, formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const current = await requireUser("INTERN");
  const user = await db.user.findUniqueOrThrow({
    where: { id: current.id },
    include: { profile: true },
  });
  const p = user.profile;

  return (
    <>
      <PageHeader
        title="Profil"
        description="Data diri Anda dilihat oleh admin untuk keperluan magang."
      />

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card className="flex flex-col items-center text-center">
            <Avatar name={user.name} size="lg" />
            <p className="mt-4 text-lg font-bold">{user.name}</p>
            <p className="text-sm text-muted">{user.email}</p>
            <p className="mt-4 text-xs text-muted">
              Bergabung {formatDate(user.createdAt)}
            </p>
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
              <Field
                label="Sekolah / kampus"
                name="institution"
                defaultValue={p?.institution ?? ""}
              />
              <Field label="Jurusan" name="major" defaultValue={p?.major ?? ""} />
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
