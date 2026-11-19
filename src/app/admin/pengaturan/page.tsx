import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { updateCertificateSettings, updateOffice } from "@/actions/admin";
import { OfficeMapPicker } from "@/components/office-map-picker";
import { ActionForm, Field } from "@/components/ui/form";
import { Card, CardTitle, PageHeader } from "@/components/ui/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { mapsUrl } from "@/lib/geo";
import { getOfficeSetting } from "@/lib/queries";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  await requireSuperAdmin();
  const o = await getOfficeSetting();

  return (
    <>
      <PageHeader
        title="Pengaturan absensi"
        description="Atur titik kantor dan radius absen langsung di peta, lalu jam kerja."
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardTitle title="Lokasi & jam kerja" hint="Jam memakai zona waktu WIB." />
          <ActionForm action={updateOffice} submitLabel="Simpan pengaturan" variant="brand">
            <Field label="Nama lokasi" name="name" defaultValue={o.name} />
            <OfficeMapPicker
              latitude={o.latitude}
              longitude={o.longitude}
              radiusMeters={o.radiusMeters}
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

        <div className="h-fit space-y-6 xl:sticky xl:top-6 self-start">
        <Card>
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

        <Card>
          <CardTitle title="Sertifikat" hint="Tercetak di sertifikat peserta yang selesai magang." />
          <ActionForm action={updateCertificateSettings} submitLabel="Simpan" idPrefix="cert-">
            <Field label="Nama instansi" name="orgName" defaultValue={o.orgName} maxLength={100} />
            <Field label="Kota penerbitan" name="certCity" defaultValue={o.certCity} maxLength={60} />
            <Field label="Jabatan penandatangan" name="signerTitle" defaultValue={o.signerTitle} maxLength={100} />
            <Field
              label="Nama penandatangan"
              name="signerName"
              defaultValue={o.signerName}
              maxLength={100}
              hint="Kosongkan jika ingin ditandatangani manual."
            />
          </ActionForm>
        </Card>
        </div>
      </div>
    </>
  );
}
