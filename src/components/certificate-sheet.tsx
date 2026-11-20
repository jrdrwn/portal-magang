import { Sparkles } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { internshipTypeInfo } from "@/lib/labels";
import type { getCertificate } from "@/lib/certificate";

type Cert = NonNullable<Awaited<ReturnType<typeof getCertificate>>>;

/** Lembar sertifikat A4 landscape. Ukuran teks memakai unit container (cqw) agar ikut menyesuaikan lebar. */
export function CertificateSheet({
  cert,
  org,
  verifyUrl,
  qr,
}: {
  cert: Cert;
  org: { orgName: string; certCity: string; signerName: string; signerTitle: string };
  verifyUrl: string;
  qr: string;
}) {
  const r = cert.registration;
  return (
    <div className="@container mx-auto w-full max-w-[1100px] print:max-w-none">
      <article
        aria-label={`Sertifikat ${r.user.name}`}
        className="relative aspect-[297/210] w-full overflow-hidden bg-white text-ink shadow-card print:shadow-none"
      >
        <div aria-hidden className="absolute -left-[8cqw] -top-[8cqw] size-[28cqw] rounded-full bg-brand-100" />
        <div aria-hidden className="absolute -bottom-[10cqw] -right-[6cqw] size-[30cqw] rounded-full bg-lime/60" />
        <div aria-hidden className="absolute inset-[2.2cqw] rounded-[1.6cqw] border-[0.35cqw] border-brand-600" />
        <div aria-hidden className="absolute inset-[3cqw] rounded-[1.2cqw] border-[0.12cqw] border-brand-200" />

        <div className="relative flex h-full flex-col items-center px-[9cqw] pb-[5cqw] pt-[6cqw] text-center">
          <div className="flex items-center gap-[1cqw]">
            <span className="grid size-[4cqw] place-items-center rounded-[1cqw] bg-brand-600 text-white">
              <Sparkles className="size-[2.2cqw]" aria-hidden />
            </span>
            <span className="text-[1.6cqw] font-bold tracking-tight">{org.orgName}</span>
          </div>

          <p className="mt-[2.6cqw] text-[5.2cqw] font-extrabold uppercase leading-none tracking-[0.18em] text-brand-700">
            Sertifikat
          </p>
          <p className="mt-[0.8cqw] text-[1.3cqw] font-medium uppercase tracking-[0.3em] text-muted">
            Magang · Nomor {cert.number}
          </p>

          <p className="mt-[2.6cqw] text-[1.45cqw] text-muted">Diberikan kepada</p>
          <p className="mt-[0.4cqw] text-[4.2cqw] font-bold leading-tight tracking-tight">{r.user.name}</p>
          {r.user.profile?.institution ? (
            <p className="text-[1.45cqw] text-muted">{r.user.profile.institution}</p>
          ) : null}
          <div aria-hidden className="mt-[1.2cqw] h-[0.25cqw] w-[26cqw] rounded-full bg-brand-600" />

          <p className="mt-[1.8cqw] max-w-[70cqw] text-[1.55cqw] leading-relaxed">
            atas partisipasinya menyelesaikan program magang{" "}
            <b>{internshipTypeInfo[r.type].label}</b> di tim <b>{r.team.name}</b> pada{" "}
            <b>{formatDate(r.startDate, "long")}</b> sampai <b>{formatDate(r.endDate, "long")}</b>
            {cert.predicate ? (
              <>
                {" "}dengan predikat <b>{cert.predicate.label}</b>
              </>
            ) : null}
            .
          </p>

          <div className="mt-auto flex w-full items-end justify-between gap-[3cqw] text-left">
            <div className="flex items-end gap-[1.4cqw]">
              <div className="size-[9cqw] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="pb-[0.3cqw] text-[1.05cqw] leading-snug text-muted">
                <p className="font-semibold text-ink">Verifikasi keaslian</p>
                <p>Pindai QR atau buka</p>
                <p className="break-all font-mono text-ink">{verifyUrl}</p>
              </div>
            </div>
            <div className="min-w-[24cqw] text-center text-[1.3cqw]">
              <p>
                {org.certCity}, {formatDate(cert.issuedAt, "long")}
              </p>
              <p className="font-semibold">{org.signerTitle}</p>
              <div className="h-[5cqw]" />
              <p className="border-t-[0.12cqw] border-ink pt-[0.5cqw] font-bold">
                {org.signerName || "\u00a0"}
              </p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
