import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { CertificateSheet } from "@/components/certificate-sheet";
import { PrintButton } from "@/components/print-button";
import { ButtonLink } from "@/components/ui/ui";
import { isAdmin, requireUser } from "@/lib/auth";
import { getCertificate, publicOrigin, qrSvg } from "@/lib/certificate";
import { getOfficeSetting } from "@/lib/queries";

export const metadata: Metadata = { title: "Sertifikat", robots: { index: false } };

export default function CertificatePrintPage({ params }: PageProps<"/cetak/sertifikat/[id]">) {
  return (
    <main className="min-h-dvh px-3 py-6 sm:px-6 print:p-0">
      <style>{"@page { size: A4 landscape; margin: 0 } @media print { html, body { background: #fff } }"}</style>
      <Suspense
        fallback={
          <div className="mx-auto aspect-[297/210] w-full max-w-[1100px] animate-pulse rounded-card bg-surface" />
        }
      >
        <Certificate params={params} />
      </Suspense>
    </main>
  );
}

async function Certificate({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const cert = await getCertificate({ id });
  if (!cert) notFound();

  // Pemilik, admin utama, atau admin tim dari tim pendaftaran ini.
  const reg = cert.registration;
  const allowed =
    reg.user.id === user.id ||
    user.role === "SUPER_ADMIN" ||
    (user.role === "TEAM_ADMIN" && user.teamId === reg.teamId);
  if (!allowed) notFound();

  const [office, origin] = await Promise.all([getOfficeSetting(), publicOrigin()]);
  const verifyUrl = `${origin}/verifikasi/${cert.code}`;
  const qr = await qrSvg(verifyUrl);

  return (
    <>
      <div className="mx-auto mb-5 flex max-w-[1100px] flex-wrap items-center justify-between gap-3 print:hidden">
        <ButtonLink href={isAdmin(user.role) ? `/admin/peserta/${reg.user.id}` : "/sertifikat"} variant="ghost">
          <ArrowLeft className="size-4" aria-hidden />
          Kembali
        </ButtonLink>
        <div className="flex items-center gap-3">
          <p className="hidden text-sm text-muted sm:block">Pilih “Simpan sebagai PDF” di dialog cetak.</p>
          <PrintButton />
        </div>
      </div>
      <CertificateSheet cert={cert} org={office} verifyUrl={verifyUrl} qr={qr} />
    </>
  );
}
