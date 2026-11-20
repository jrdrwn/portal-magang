import type { Metadata } from "next";
import { DocumentLinks } from "@/components/document-links";
import Link from "next/link";
import clsx from "clsx";
import { ReviewControls } from "@/components/review-controls";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui/ui";
import { requireAdmin, teamScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysBetweenInclusive, formatDate } from "@/lib/dates";
import { internshipTypeInfo, registrationLabel } from "@/lib/labels";
import { quotaUsed } from "@/lib/queries";
import type { RegistrationStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Pendaftaran" };

const tabs: { key: RegistrationStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Menunggu" },
  { key: "APPROVED", label: "Disetujui" },
  { key: "REJECTED", label: "Ditolak" },
  { key: "ALL", label: "Semua" },
];

export default async function AdminRegistrations({
  searchParams,
}: PageProps<"/admin/pendaftaran">) {
  const admin = await requireAdmin();
  const scope = teamScope(admin);
  const regScope = scope ? { teamId: scope } : {};
  const sp = await searchParams;
  const raw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const current = tabs.find((t) => t.key === raw)?.key ?? "PENDING";

  const [rows, grouped] = await Promise.all([
    db.registration.findMany({
      where: current === "ALL" ? regScope : { status: current, ...regScope },
      include: {
        user: { select: { id: true, name: true, email: true, profile: true } },
        team: { select: { name: true, quota: true } },
        documents: { select: { id: true, kind: true, fileName: true, size: true }, orderBy: { kind: "asc" } },
      },
      orderBy: { createdAt: current === "PENDING" ? "asc" : "desc" },
      take: 100,
    }),
    db.registration.groupBy({
      by: ["status"],
      where: regScope,
      _count: { _all: true },
    }),
  ]);
  const usage = new Map(
    await Promise.all(
      rows
        .filter((r) => r.status === "PENDING" && r.team.quota != null)
        .map(async (r) => [r.id, await quotaUsed(r.teamId, r.startDate, r.endDate, r.id)] as const),
    ),
  );
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  const total = grouped.reduce((s, g) => s + g._count._all, 0);

  return (
    <>
      <PageHeader
        title="Pendaftaran"
        description="Tinjau pengajuan magang: setujui atau tolak."
      />

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter status">
        {tabs.map((t) => {
          const n = t.key === "ALL" ? total : (counts[t.key] ?? 0);
          return (
            <Link
              key={t.key}
              href={`/admin/pendaftaran?status=${t.key}`}
              role="tab"
              aria-selected={current === t.key}
              className={clsx(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                current === t.key
                  ? "bg-ink text-white"
                  : "bg-surface text-muted hover:text-ink",
              )}
            >
              {t.label} <span className="opacity-60">{n}</span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="Tidak ada pendaftaran" description="Belum ada data pada filter ini." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/admin/peserta/${r.user.id}`}
                  className="flex min-w-0 items-center gap-3 hover:underline"
                >
                  <Avatar name={r.user.name} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.user.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {r.user.profile?.institution ?? r.user.email}
                    </span>
                  </span>
                </Link>
                <Badge tone={registrationLabel[r.status].tone}>
                  {registrationLabel[r.status].label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-3xl bg-canvas/70 p-4 text-sm">
                <div>
                  <p className="text-xs text-muted">Tim</p>
                  <p className="font-semibold">{r.team.name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted">Jenis magang</p>
                  <p className="font-semibold">
                    {internshipTypeInfo[r.type].label}
                    {r.graduationYear ? ` · lulus ${r.graduationYear}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Durasi</p>
                  <p className="font-semibold">{daysBetweenInclusive(r.startDate, r.endDate)} hari</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted">Periode</p>
                  <p className="font-semibold">
                    {formatDate(r.startDate)} – {formatDate(r.endDate)}
                  </p>
                </div>
              </div>

              {usage.has(r.id) ? (
                <p
                  className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
                    usage.get(r.id)! >= r.team.quota! ? "bg-rose text-[#a0153f]" : "bg-sky text-[#1c4a8a]"
                  }`}
                >
                  Kuota tim pada periode ini: {usage.get(r.id)}/{r.team.quota} terisi
                  {usage.get(r.id)! >= r.team.quota! ? " (penuh)" : ""}
                </p>
              ) : null}

              <p className="whitespace-pre-line text-sm text-muted">{r.motivation}</p>
              <DocumentLinks docs={r.documents} />

              {r.reviewNote ? (
                <p className="rounded-2xl bg-brand-50 p-3 text-sm">
                  <span className="font-semibold">Catatan: </span>
                  {r.reviewNote}
                </p>
              ) : null}

              <ReviewControls id={r.id} status={r.status} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
