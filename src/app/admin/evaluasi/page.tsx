import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
  btn,
} from "@/components/ui/ui";
import { requireAdmin, teamScope } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  averageScore,
  currentMonthKey,
  formatMonth,
  grade,
  isValidMonthKey,
  monthEnd,
  monthStart,
  shiftMonth,
} from "@/lib/evaluation";
import { internshipTypeInfo } from "@/lib/labels";
import { summariesFor } from "@/lib/calendar";

export const metadata: Metadata = { title: "Evaluasi bulanan" };

export default async function EvaluationsPage({ searchParams }: PageProps<"/admin/evaluasi">) {
  const admin = await requireAdmin();
  const scope = teamScope(admin);
  const sp = await searchParams;
  const raw = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const now = currentMonthKey();
  const month = isValidMonthKey(raw) && raw <= now ? raw : now;
  const start = monthStart(month);
  const end = monthEnd(month);

  const regs = await db.registration.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: end },
      endDate: { gte: start },
      ...(scope ? { teamId: scope } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      team: { select: { name: true } },
      evaluations: { where: { month: start } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const summaries = await summariesFor(regs, start, end);
  const sumOf = (userId: string) => summaries.get(userId);

  const done = regs.filter((r) => r.evaluations.length > 0);
  const avgAll = done.length
    ? Math.round((done.reduce((s, r) => s + averageScore(r.evaluations[0]), 0) / done.length) * 10) / 10
    : null;

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <>
      <PageHeader
        title="Evaluasi bulanan"
        description={`Penilaian peserta untuk ${formatMonth(month)}${admin.role === "TEAM_ADMIN" ? ` · ${admin.teamName ?? "tanpa tim"}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/evaluasi?month=${prev}`}
              aria-label="Bulan sebelumnya"
              className="grid size-10 place-items-center rounded-full bg-surface shadow-card"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <span className="min-w-36 rounded-full bg-surface px-4 py-2.5 text-center text-sm font-semibold capitalize shadow-card">
              {formatMonth(month)}
            </span>
            <Link
              href={`/admin/evaluasi?month=${next}`}
              aria-label="Bulan berikutnya"
              aria-disabled={next > now}
              className={clsx(
                "grid size-10 place-items-center rounded-full bg-surface shadow-card",
                next > now && "pointer-events-none opacity-40",
              )}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex justify-end">
        <a
          href={`/admin/export/evaluasi?month=${month}`}
          className={clsx(btn.base, btn.soft, "py-2.5")}
          download
        >
          <Download className="size-4" aria-hidden />
          Unduh CSV {formatMonth(month)}
        </a>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Peserta bulan ini" value={regs.length} tone="dark" />
        <StatCard label="Sudah dinilai" value={`${done.length}/${regs.length}`} tone="lime" />
        <StatCard
          label="Rata-rata nilai"
          value={avgAll ?? "-"}
          hint={avgAll != null ? grade(avgAll).label : "belum ada penilaian"}
          tone="sky"
        />
      </div>

      <Card>
        {regs.length === 0 ? (
          <EmptyState
            title="Tidak ada peserta"
            description="Tidak ada peserta dengan periode magang pada bulan ini."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Peserta</Th>
                <Th>Tim</Th>
                <Th>Kehadiran</Th>
                <Th>Nilai</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => {
                const e = r.evaluations[0];
                const avg = e ? averageScore(e) : null;
                const g = avg != null ? grade(avg) : null;
                return (
                  <tr key={r.id}>
                    <Td primary>
                      <Link href={`/admin/peserta/${r.user.id}`} className="flex items-center gap-3 hover:underline">
                        <Avatar name={r.user.name} size="sm" />
                        <span>
                          <span className="block font-semibold">{r.user.name}</span>
                          <span className="block text-xs text-muted">{r.user.email}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td label="Tim">
                      <span className="block font-medium">{r.team.name}</span>
                      <span className="text-xs text-muted">{internshipTypeInfo[r.type].label}</span>
                    </Td>
                    <Td label="Kehadiran" className="text-xs">
                      <span className="font-semibold">{(sumOf(r.userId)?.present ?? 0) + (sumOf(r.userId)?.late ?? 0)}</span> hadir ·{" "}
                      {sumOf(r.userId)?.late ?? 0} terlambat · {(sumOf(r.userId)?.permit ?? 0) + (sumOf(r.userId)?.sick ?? 0)} izin/sakit ·{" "}
                      <span className={(sumOf(r.userId)?.absent ?? 0) > 0 ? "font-semibold text-[#a0153f]" : undefined}>
                        {sumOf(r.userId)?.absent ?? 0} alpa
                      </span>
                    </Td>
                    <Td label="Nilai">
                      {g ? (
                        <span className="flex items-center gap-2">
                          <span className="font-bold">{avg}</span>
                          <Badge tone={g.tone}>{g.letter}</Badge>
                        </span>
                      ) : (
                        <Badge tone="warning">Belum dinilai</Badge>
                      )}
                    </Td>
                    <Td actions className="text-right">
                      <ButtonLink
                        href={`/admin/evaluasi/${r.id}?month=${month}`}
                        variant={e ? "soft" : "primary"}
                        className="px-4 py-2"
                      >
                        {e ? "Ubah" : "Nilai"}
                      </ButtonLink>
                    </Td>
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
