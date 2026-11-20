import "server-only";
import * as webpush from "web-push";
import { db } from "./db";

/**
 * Web Push. Aktif hanya bila kunci VAPID diatur:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (buat dengan `npx web-push generate-vapid-keys`)
 *   VAPID_SUBJECT (opsional, mis. mailto:admin@kantor.id)
 */
let configured: boolean | null = null;

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function ensureConfigured() {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@portal-magang.local", pub, priv);
  return (configured = true);
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Kirim push ke semua perangkat milik user. Langganan yang sudah tidak berlaku dihapus. */
export async function pushToUsers(userIds: string[], payload: PushPayload) {
  if (!ensureConfigured() || userIds.length === 0) return { sent: 0, removed: 0 };
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: [...new Set(userIds)] } } });
  let sent = 0;
  const dead: string[] = [];
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 6, urgency: "high", timeout: 10_000 },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else console.warn("[push] gagal kirim:", status ?? (err as Error).message);
      }
    }),
  );
  if (dead.length) await db.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  if (sent) {
    await db.pushSubscription.updateMany({
      where: { id: { in: subs.filter((s) => !dead.includes(s.id)).map((s) => s.id) } },
      data: { lastUsedAt: new Date() },
    });
  }
  return { sent, removed: dead.length };
}
