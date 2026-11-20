import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Avatar, Card, EmptyState, PageHeader, Table, Td, Th, btn, inputClass } from "@/components/ui/ui";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit";
import { requireAdmin, teamScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, isValidDateKey, keyToDate } from "@/lib/dates";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Log admin" };

const PAGE_SIZE = 50;
const fmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/log">) {
  const admin = await requireAdmin();
  const scope = teamScope(admin);
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const action = one("action") in AUDIT_ACTIONS ? (one("action") as AuditAction) : "";
  const actor = one("actor");
  const from = isValidDateKey(one("from")) ? one("from") : "";
  const to = isValidDateKey(one("to")) ? one("to") : "";
  const page = Math.max(1, Math.min(1000, Number(one("page")) || 1));

  const where: Prisma.AuditLogWhereInput = {
    ...(scope ? { teamId: scope } : {}),
    ...(action ? { action } : {}),
    ...(actor ? { actorId: actor } : {}),
    ...(from || to
      ? {
          createdAt: {
            // Tanggal WIB: 00:00 WIB = 17:00 UTC hari sebelumnya.
            ...(from ? { gte: new Date(keyToDate(from).getTime() - 7 * 3600_000) } : {}),
            ...(to ? { lt: new Date(addDays(keyToDate(to), 1).getTime() - 7 * 3600_000) } : {}),
          },
        }
      : {}),
  };

  const [logs, total, actors] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
    db.user.findMany({
      where: {
        role: { in: ["SUPER_ADMIN", "TEAM_ADMIN"] },
        ...(scope ? { auditLogs: { some: { teamId: scope } } } : {}),
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (action) u.set("action", action);
    if (actor) u.set("actor", actor);
    if (from) u.set("from", from);
    if (to) u.set("to", to);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <PageHeader
        title="Log admin"
        description={`${total} catatan tindakan admin${admin.role === "TEAM_ADMIN" ? ` terkait tim ${admin.teamName ?? "-"}` : ""}.`}
      />

      <Card>
        <form className="mb-5 flex flex-wrap items-end gap-2">
          <Combobox
            name="action"
            mode="search"
            ariaLabel="Filter tindakan"
            placeholder="Semua tindakan"
            defaultValue={action}
            options={[
              { value: "", label: "Semua tindakan" },
              ...Object.entries(AUDIT_ACTIONS).map(([value, label]) => ({ value, label })),
            ]}
            className="w-64"
          />
          <Combobox
            name="actor"
            mode="search"
            ariaLabel="Filter admin"
            placeholder="Semua admin"
            defaultValue={actor}
            options={[
              { value: "", label: "Semua admin" },
              ...actors.map((a) => ({ value: a.id, label: a.name, description: a.email })),
            ]}
            className="w-56"
          />
          <label className="text-xs font-semibold text-muted">
            Dari
            <input type="date" name="from" defaultValue={from} className={clsx(inputClass, "mt-1 w-auto py-2.5")} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Sampai
            <input type="date" name="to" defaultValue={to} className={clsx(inputClass, "mt-1 w-auto py-2.5")} />
          </label>
          <button type="submit" className={clsx(btn.base, btn.primary, "py-3")}>
            Terapkan
          </button>
          {action || actor || from || to ? (
            <Link href="/admin/log" className={clsx(btn.base, btn.ghost, "py-3")}>
              Reset
            </Link>
          ) : null}
        </form>

        {logs.length === 0 ? (
          <EmptyState title="Belum ada catatan" description="Tindakan admin akan tercatat di sini." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Waktu</Th>
                <Th>Admin</Th>
                <Th>Tindakan</Th>
                <Th>Keterangan</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-xs text-muted">{fmt.format(l.createdAt).replace(".", ":")}</Td>
                  <Td>
                    {l.actor ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={l.actor.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{l.actor.name}</span>
                          <span className="block truncate text-xs text-muted">{l.actor.email}</span>
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted">Akun dihapus</span>
                    )}
                  </Td>
                  <Td className="font-medium">{AUDIT_ACTIONS[l.action as AuditAction] ?? l.action}</Td>
                  <Td className="text-sm">{l.summary}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {pages > 1 ? (
          <nav aria-label="Halaman" className="mt-5 flex items-center justify-between gap-3 text-sm">
            <Link
              href={`/admin/log${qs(page - 1)}`}
              aria-disabled={page <= 1}
              className={clsx(btn.base, btn.soft, "px-4 py-2", page <= 1 && "pointer-events-none opacity-40")}
            >
              <ChevronLeft className="size-4" aria-hidden /> Sebelumnya
            </Link>
            <span className="text-muted">
              Halaman {page} dari {pages}
            </span>
            <Link
              href={`/admin/log${qs(page + 1)}`}
              aria-disabled={page >= pages}
              className={clsx(btn.base, btn.soft, "px-4 py-2", page >= pages && "pointer-events-none opacity-40")}
            >
              Berikutnya <ChevronRight className="size-4" aria-hidden />
            </Link>
          </nav>
        ) : null}
      </Card>
    </>
  );
}
