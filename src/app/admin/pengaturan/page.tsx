import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { updateOffice } from "@/actions/admin";
import { UseMyLocation } from "@/components/use-my-location";
import { ActionForm, Field } from "@/components/ui/form";
import { Card, CardTitle, PageHeader } from "@/components/ui/ui";
import { requireUser } from "@/lib/auth";
import { mapsUrl } from "@/lib/geo";
import { getOfficeSetting } from "@/lib/queries";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  await requireUser("ADMIN");
  const o = await getOfficeSetting();

  return (
    <>
      <PageHeader
        title="Pengaturan absensi"
        description="Titik lokasi, radius, dan jam kerja yang dipakai untuk memvalidasi absen."
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardTitle title="Lokasi & jam kerja" hint="Jam memakai zona waktu WIB." />
          <ActionForm action={updateOffice} submitLabel="Simpan pengaturan" variant="brand" extra={<UseMyLocation />}>
            <Field label="Nama lokasi" name="name" defaultValue={o.name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" name="latitude" inputMode="decimal" defaultValue={String(o.latitude)} />
              <Field label="Longitude" name="longitude" inputMode="decimal" defaultValue={String(o.longitude)} />
            </div>
            <Field
              label="Radius absen (meter)"
              name="radiusMeters"
              type="number"
              min={20}
              max={5000}
              defaultValue={o.radiusMeters}
              hint="Peserta hanya bisa absen dalam jarak ini dari titik kantor."
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Jam masuk" name="workStart" type="time" defaultValue={o.workStart} />
              <Field
                label="Terlambat setelah"
                name="lateAfter"
                type="time"
                defaultValue={o.lateAfter}
              />
              <Field label="Jam pulang" name="workEnd" type="time" defaultValue={o.workEnd} />
            </div>
          </ActionForm>
        </Card>

        <Card className="h-fit">
          <CardTitle title="Titik saat ini" />
          <p className="font-semibold">{o.name}</p>
          <p className="mt-1 text-sm text-muted">
            {o.latitude.toFixed(6)}, {o.longitude.toFixed(6)} · radius {o.radiusMeters} m
          </p>
          <a
            href={mapsUrl(o.latitude, o.longitude)}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
          >
            Buka di OpenStreetMap <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </Card>
      </div>
    </>
  );
}
