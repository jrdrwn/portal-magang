import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  btn,
  inputClass,
} from "@/components/ui/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, todayDate } from "@/lib/dates";
import type { Tone } from "@/lib/labels";
import clsx from "clsx";

export const metadata: Metadata = { title: "Peserta" };

export default async function InternsPage({ searchParams }: PageProps<"/admin/peserta">) {
  await requireUser("ADMIN");
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 80) ?? "";
  const today = todayDate();

  const users = await db.user.findMany({
    where: {
      role: "INTERN",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { profile: { institution: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      profile: true,
      registrations: { orderBy: { startDate: "desc" } },
      _count: { select: { attendances: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  function stateOf(u: (typeof users)[number]): { label: string; tone: Tone } {
    if (!u.isActive) return { label: "Nonaktif", tone: "danger" };
    const approved = u.registrations.filter((r) => r.status === "APPROVED");
    if (approved.some((r) => r.startDate <= today && r.endDate >= today)) {
      return { label: "Aktif", tone: "success" };
    }
    if (approved.some((r) => r.startDate > today)) return { label: "Akan datang", tone: "info" };
    if (approved.length > 0) return { label: "Selesai", tone: "neutral" };
    if (u.registrations.some((r) => r.status === "PENDING")) return { label: "Menunggu", tone: "warning" };
    return { label: "Belum mendaftar", tone: "neutral" };
  }

  return (
    <>
      <PageHeader title="Peserta" description={`${users.length} peserta${q ? ` untuk "${q}"` : ""}`} />

      <Card>
        <form role="search" className="mb-5 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="q" className="sr-only">
              Cari peserta
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Cari nama, email, atau asal sekolah/kampus"
              className={clsx(inputClass, "pl-11")}
            />
          </div>
          <button type="submit" className={clsx(btn.base, btn.primary)}>
            Cari
          </button>
        </form>

        {users.length === 0 ? (
          <EmptyState title="Peserta tidak ditemukan" description="Coba kata kunci lain." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Peserta</Th>
                <Th>Asal</Th>
                <Th>Periode terakhir</Th>
                <Th>Status</Th>
                <Th className="text-right">Absensi</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const state = stateOf(u);
                const latest = u.registrations.find((r) => r.status === "APPROVED") ?? u.registrations[0];
                return (
                  <tr key={u.id} className="transition hover:bg-canvas/50">
                    <Td>
                      <Link href={`/admin/peserta/${u.id}`} className="flex items-center gap-3 hover:underline">
                        <Avatar name={u.name} size="sm" />
                        <span>
                          <span className="block font-semibold">{u.name}</span>
                          <span className="block text-xs text-muted">{u.email}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td>{u.profile?.institution ?? "-"}</Td>
                    <Td>
                      {latest ? (
                        <>
                          <span className="block font-medium">{latest.division}</span>
                          <span className="text-xs text-muted">
                            {formatDate(latest.startDate)} – {formatDate(latest.endDate)}
                          </span>
                        </>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td>
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </Td>
                    <Td className="text-right font-semibold">{u._count.attendances}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
