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
import { dailyStatuses, dayStatusLabel, getCalendar } from "@/lib/calendar";

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

  // Semua periode magang disetujui yang bersinggungan dengan rentang ekspor.
  const regs = await db.registration.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: to },
      endDate: { gte: from },
      ...(scope ? { teamId: scope } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } }, team: { select: { name: true } } },
  });
  const [records, cal] = await Promise.all([
    db.attendance.findMany({
      where: { userId: { in: regs.map((r) => r.userId) }, date: { gte: from, lte: to } },
      include: { correctedBy: { select: { name: true } } },
    }),
    getCalendar(from, to),
  ]);
  const recordOf = new Map(records.map((r) => [`${r.userId}|${dateToKey(r.date)}`, r]));

  const lines: { key: string; name: string; cells: unknown[] }[] = [];
  for (const reg of regs) {
    const start = reg.startDate > from ? reg.startDate : from;
    const end = reg.endDate < to ? reg.endDate : to;
    const own = records.filter((r) => r.userId === reg.userId);
    for (const day of dailyStatuses(start, end, own, cal)) {
      if (day.status === "OFF") continue;
      const k = dateToKey(day.date);
      const a = recordOf.get(`${reg.userId}|${k}`);
      const status =
        day.status in attendanceLabel
          ? attendanceLabel[day.status as keyof typeof attendanceLabel].label
          : dayStatusLabel[day.status as keyof typeof dayStatusLabel];
      lines.push({
        key: k,
        name: reg.user.name,
        cells: [
          k,
          reg.user.name,
          reg.user.email,
          reg.team.name,
          internshipTypeInfo[reg.type].label,
          status,
          a?.checkInAt ? formatTime(a.checkInAt) : "",
          a?.checkOutAt ? formatTime(a.checkOutAt) : "",
          a?.checkInDistance != null ? Math.round(a.checkInDistance) : "",
          day.holidayName ?? a?.note ?? "",
          a?.correctedAt ? `Ya (${a.correctedBy?.name ?? "admin"}: ${a.correctionReason ?? ""})` : "",
        ],
      });
    }
  }
  lines.sort((x, y) => x.key.localeCompare(y.key) || x.name.localeCompare(y.name));

  const csv = toCsv(
    ["Tanggal", "Nama", "Email", "Tim", "Jenis magang", "Status", "Masuk", "Pulang", "Jarak masuk (m)", "Keterangan", "Dikoreksi"],
    lines.map((l) => l.cells),
  );
  return csvResponse(`absensi_${fromKey}_${toKey}.csv`, csv);
}
