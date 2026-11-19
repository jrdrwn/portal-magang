import type { NextRequest } from "next/server";
import { getCurrentUser, isAdmin, teamScope } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import {
  daysBetweenInclusive,
  formatTime,
  isValidDateKey,
  keyToDate,
  dateToKey,
} from "@/lib/dates";
import { attendanceLabel, internshipTypeInfo } from "@/lib/labels";
import { internInTeam } from "@/lib/queries";

const MAX_DAYS = 93;

/** GET /admin/export/absensi?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || !isAdmin(admin.role)) {
    return new Response("Tidak diizinkan", { status: 403 });
  }
  const scope = teamScope(admin);

  const sp = request.nextUrl.searchParams;
  const fromKey = sp.get("from");
  const toKey = sp.get("to");
  if (!isValidDateKey(fromKey) || !isValidDateKey(toKey)) {
    return new Response("Parameter from/to wajib berformat YYYY-MM-DD", { status: 400 });
  }
  const from = keyToDate(fromKey);
  const to = keyToDate(toKey);
  if (to < from) return new Response("Tanggal akhir sebelum tanggal awal", { status: 400 });
  if (daysBetweenInclusive(from, to) > MAX_DAYS) {
    return new Response(`Rentang maksimal ${MAX_DAYS} hari`, { status: 400 });
  }

  const rows = await db.attendance.findMany({
    where: { date: { gte: from, lte: to }, ...(scope ? { user: internInTeam(scope) } : {}) },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          registrations: {
            where: { status: "APPROVED", ...(scope ? { teamId: scope } : {}) },
            select: {
              startDate: true,
              endDate: true,
              type: true,
              team: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
  });

  const csv = toCsv(
    ["Tanggal", "Nama", "Email", "Tim", "Jenis magang", "Status", "Masuk", "Pulang", "Jarak masuk (m)", "Keterangan"],
    rows.map((a) => {
      const reg = a.user.registrations.find((r) => r.startDate <= a.date && r.endDate >= a.date);
      return [
        dateToKey(a.date),
        a.user.name,
        a.user.email,
        reg?.team.name ?? "",
        reg ? internshipTypeInfo[reg.type].label : "",
        attendanceLabel[a.status].label,
        a.checkInAt ? formatTime(a.checkInAt) : "",
        a.checkOutAt ? formatTime(a.checkOutAt) : "",
        a.checkInDistance != null ? Math.round(a.checkInDistance) : "",
        a.note ?? "",
      ];
    }),
  );
  return csvResponse(`absensi_${fromKey}_${toKey}.csv`, csv);
}
