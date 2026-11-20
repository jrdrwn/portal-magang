import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

const WINDOW_MS = 15 * 60_000;
const MAX_FAILED_PER_EMAIL = 5; // per 15 menit
const MAX_FAILED_PER_IP = 20; // per 15 menit, semua email
const REGISTER_WINDOW_MS = 60 * 60_000;
const MAX_REGISTER_PER_IP = 5; // akun baru per jam per IP
const KEEP_MS = 24 * 60 * 60_000;

/** IP klien dari header proxy (Vercel/Cloudflare/nginx), atau null. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("cf-connecting-ip") || h.get("x-real-ip") || null;
}

function minutesLeft(oldest: Date | undefined, windowMs: number) {
  if (!oldest) return 1;
  return Math.max(1, Math.ceil((oldest.getTime() + windowMs - Date.now()) / 60_000));
}

/** Cek apakah login untuk email/IP ini sedang diblokir. Mengembalikan pesan jika ya. */
export async function loginBlocked(email: string, ip: string | null) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    db.authAttempt.findMany({
      where: { kind: "LOGIN", key: email, success: false, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
      take: MAX_FAILED_PER_EMAIL,
    }),
    ip
      ? db.authAttempt.count({
          where: { kind: "LOGIN", ip, success: false, createdAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);

  if (byEmail.length >= MAX_FAILED_PER_EMAIL) {
    return `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutesLeft(byEmail[0]?.createdAt, WINDOW_MS)} menit.`;
  }
  if (byIp >= MAX_FAILED_PER_IP) {
    return "Terlalu banyak percobaan dari jaringan ini. Coba lagi dalam 15 menit.";
  }
  return null;
}

export async function recordLogin(email: string, ip: string | null, success: boolean) {
  if (success) {
    // Login berhasil mengosongkan hitungan gagal untuk email ini.
    await db.authAttempt.deleteMany({ where: { kind: "LOGIN", key: email, success: false } });
  } else {
    await db.authAttempt.create({ data: { kind: "LOGIN", key: email, ip, success: false } });
  }
  await cleanup();
}

export async function registerBlocked(ip: string | null) {
  if (!ip) return null;
  const count = await db.authAttempt.count({
    where: {
      kind: "REGISTER",
      key: ip,
      createdAt: { gte: new Date(Date.now() - REGISTER_WINDOW_MS) },
    },
  });
  return count >= MAX_REGISTER_PER_IP
    ? "Terlalu banyak akun dibuat dari jaringan ini. Coba lagi dalam 1 jam."
    : null;
}

export async function recordRegister(ip: string | null) {
  if (!ip) return;
  await db.authAttempt.create({ data: { kind: "REGISTER", key: ip, ip, success: true } });
}

/** Hapus catatan lebih dari 24 jam. Murah karena ada index createdAt. */
async function cleanup() {
  if (Math.random() < 0.1) {
    await db.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } } });
  }
}
