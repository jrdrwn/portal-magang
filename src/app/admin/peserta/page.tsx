import type { Metadata } from "next";
import Link from "next/link";
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
} from "@/components/ui/ui";
import { requireAdmin, teamScope } from "@/lib/auth";
import { internInTeam } from "@/lib/queries";
import { Combobox } from "@/components/ui/combobox";
import { db } from "@/lib/db";
import { formatDate, todayDate } from "@/lib/dates";
import { internshipTypeInfo, type Tone } from "@/lib/labels";
import clsx from "clsx";

export const metadata: Metadata = { title: "Peserta" };

export default async function InternsPage({ searchParams }: PageProps<"/admin/peserta">) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = one(sp.q)?.trim().slice(0, 80) ?? "";
  const type = one(sp.type) === "MANDIRI" || one(sp.type) === "MAGANGHUB" ? one(sp.type) as "MANDIRI" | "MAGANGHUB" : "";
  const today = todayDate();

  const teams =
    admin.role === "SUPER_ADMIN"
      ? await db.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [];
  const pickedTeam = one(sp.team) ?? "";
  // Admin tim selalu dibatasi ke timnya; admin utama boleh memilih tim.
  const scope = teamScope(admin) ?? (teams.some((t) => t.id === pickedTeam) ? pickedTeam : null);
  const regWhere = {
    ...(scope ? { teamId: scope } : {}),
    ...(type ? { type } : {}),
  };
  const filtered = Boolean(scope || type);

  const users = await db.user.findMany({
    where: {
      role: "INTERN",
      ...(filtered
        ? { registrations: { some: { ...regWhere, ...(teamScope(admin) ? { status: "APPROVED" as const } : {}) } } }
        : {}),
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
      registrations: {
        where: regWhere,
        include: { team: { select: { name: true } } },
        orderBy: { startDate: "desc" },
      },
      _count: { select: { attendances: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const pool = await db.user.findMany({
    where: { role: "INTERN", ...(teamScope(admin) ? internInTeam(teamScope(admin)) : {}) },
    select: { name: true, email: true, profile: { select: { institution: true } } },
    orderBy: { name: "asc" },
    take: 300,
  });
  const suggestions = [
    ...new Map(
      pool.flatMap((u) => [
        [u.name, { value: u.name, label: u.name, description: u.email }],
        ...(u.profile?.institution
          ? [[u.profile.institution, { value: u.profile.institution, label: u.profile.institution, description: "Asal sekolah/kampus" }] as const]
          : []),
      ]),
    ).values(),
  ];

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
        <form role="search" className="mb-5 flex flex-wrap items-start gap-2">
          <Combobox
            name="q"
            mode="free"
            ariaLabel="Cari peserta"
            defaultValue={q}
            maxLength={80}
            placeholder="Cari nama, email, atau asal sekolah/kampus"
            options={suggestions}
            className="min-w-60 flex-1"
          />
          {teams.length > 0 ? (
            <Combobox
              name="team"
              mode="search"
              ariaLabel="Filter tim"
              placeholder="Semua tim"
              defaultValue={scope ?? ""}
              options={[{ value: "", label: "Semua tim" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
              className="w-52"
            />
          ) : null}
          <Combobox
            name="type"
            ariaLabel="Filter jenis magang"
            defaultValue={type}
            options={[
              { value: "", label: "Semua jenis" },
              { value: "MANDIRI", label: "Mandiri" },
              { value: "MAGANGHUB", label: "MagangHub" },
            ]}
            className="w-44"
          />
          <button type="submit" className={clsx(btn.base, btn.primary, "py-3")}>
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
                          <span className="block font-medium">
                            {latest.team.name}{" "}
                            <span className="text-xs font-semibold text-muted">
                              · {internshipTypeInfo[latest.type].label}
                            </span>
                          </span>
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
