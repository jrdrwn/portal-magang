import type { Metadata } from "next";
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
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysBetweenInclusive, formatDate } from "@/lib/dates";
import { registrationLabel } from "@/lib/labels";
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
  await requireUser("ADMIN");
  const sp = await searchParams;
  const raw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const current = tabs.find((t) => t.key === raw)?.key ?? "PENDING";

  const [rows, grouped] = await Promise.all([
    db.registration.findMany({
      where: current === "ALL" ? {} : { status: current },
      include: {
        user: { select: { id: true, name: true, email: true, profile: true } },
      },
      orderBy: { createdAt: current === "PENDING" ? "asc" : "desc" },
      take: 100,
    }),
    db.registration.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
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
                  <p className="text-xs text-muted">Divisi</p>
                  <p className="font-semibold">{r.division}</p>
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

              <p className="whitespace-pre-line text-sm text-muted">{r.motivation}</p>

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
