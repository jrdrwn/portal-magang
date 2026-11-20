import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeCheck, ShieldX } from "lucide-react";
import { Logo } from "@/components/shell";
import { Badge, ButtonLink, Card } from "@/components/ui/ui";
import { getCertificate } from "@/lib/certificate";
import { formatDate } from "@/lib/dates";
import { internshipTypeInfo } from "@/lib/labels";

export const metadata: Metadata = { title: "Verifikasi sertifikat", robots: { index: false } };

export default function VerifyPage({ params }: PageProps<"/verifikasi/[code]">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <Suspense fallback={<Card className="h-72 animate-pulse" />}>
        <Result params={params} />
      </Suspense>
    </main>
  );
}

async function Result({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const valid = /^[A-Z0-9]{10}$/.test(code);
  const cert = valid ? await getCertificate({ code }) : null;

  if (!cert) {
    return (
      <Card className="text-center">
        <ShieldX className="mx-auto size-12 text-[#a0153f]" aria-hidden />
        <h1 className="mt-3 text-xl font-bold">Sertifikat tidak ditemukan</h1>
        <p className="mt-1 text-sm text-muted">
          Kode <span className="font-mono">{code}</span> tidak terdaftar. Periksa kembali kode pada sertifikat.
        </p>
        <ButtonLink href="/" variant="soft" className="mt-5">
          Ke beranda
        </ButtonLink>
      </Card>
    );
  }

  const r = cert.registration;
  // Hanya data yang memang tercetak di sertifikat.
  const rows: [string, string][] = [
    ["Nama", r.user.name],
    ["Nomor", cert.number],
    ["Tim", r.team.name],
    ["Jenis magang", internshipTypeInfo[r.type].label],
    ["Periode", `${formatDate(r.startDate, "long")} – ${formatDate(r.endDate, "long")}`],
    ["Diterbitkan", formatDate(cert.issuedAt, "long")],
  ];
  if (cert.predicate) rows.push(["Predikat", cert.predicate.label]);

  return (
    <Card>
      <div className="flex items-center gap-3">
        <BadgeCheck className="size-10 shrink-0 text-[#2d7a00]" aria-hidden />
        <div>
          <h1 className="text-xl font-bold">Sertifikat asli</h1>
          <Badge tone="success">Terverifikasi</Badge>
        </div>
      </div>
      <dl className="mt-5 divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
