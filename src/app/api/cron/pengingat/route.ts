import { timingSafeEqual } from "node:crypto";
import { runDailyReminders } from "@/lib/reminders";

/**
 * Pengingat harian terjadwal. Panggil setiap 10–15 menit di jam kerja:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://domain/api/cron/pengingat
 * (Vercel Cron otomatis mengirim header ini bila CRON_SECRET diatur.)
 */
function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET belum diatur" }, { status: 503 });
  }
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  const result = await runDailyReminders();
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
