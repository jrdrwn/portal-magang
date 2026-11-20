import type { NextRequest } from "next/server";
import { getCurrentUser, isAdmin, teamScope } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { ASPECTS, averageScore, grade, isValidMonthKey, monthStart } from "@/lib/evaluation";
import { internshipTypeInfo } from "@/lib/labels";

/** GET /admin/export/evaluasi?month=YYYY-MM */
export async function GET(request: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || !isAdmin(admin.role)) {
    return new Response("Tidak diizinkan", { status: 403 });
  }
  const scope = teamScope(admin);
  const month = request.nextUrl.searchParams.get("month");
  if (!isValidMonthKey(month)) {
    return new Response("Parameter month wajib berformat YYYY-MM", { status: 400 });
  }

  const rows = await db.evaluation.findMany({
    where: { month: monthStart(month), ...(scope ? { registration: { teamId: scope } } : {}) },
    include: {
      intern: { select: { name: true, email: true } },
      evaluator: { select: { name: true } },
      registration: { select: { type: true, team: { select: { name: true } } } },
    },
    orderBy: { intern: { name: "asc" } },
  });

  const csv = toCsv(
    [
      "Bulan",
      "Nama",
      "Email",
      "Tim",
      "Jenis magang",
      ...ASPECTS.map((a) => a.label),
      "Rata-rata",
      "Predikat",
      "Catatan",
      "Penilai",
    ],
    rows.map((e) => {
      const avg = averageScore(e);
      const g = grade(avg);
      return [
        month,
        e.intern.name,
        e.intern.email,
        e.registration.team.name,
        internshipTypeInfo[e.registration.type].label,
        ...ASPECTS.map((a) => e[a.key]),
        String(avg).replace(".", ","),
        `${g.letter} (${g.label})`,
        e.notes ?? "",
        e.evaluator?.name ?? "",
      ];
    }),
  );
  return csvResponse(`evaluasi_${month}.csv`, csv);
}
