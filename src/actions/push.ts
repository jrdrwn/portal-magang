"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pushToUsers } from "@/lib/push";
import { failure, success, type ActionResult } from "@/lib/action-result";

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscription(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return failure("Langganan notifikasi tidak valid.");
  const { endpoint, keys } = parsed.data;
  const userAgent = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  // Endpoint unik per browser; bila perangkat dipakai akun lain, pindahkan ke akun ini.
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });
  revalidatePath("/profil");
  revalidatePath("/admin/akun-saya");
  return success("Notifikasi di perangkat ini aktif.");
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  revalidatePath("/profil");
  revalidatePath("/admin/akun-saya");
  return success("Notifikasi di perangkat ini dimatikan.");
}

export async function setReminders(enabled: boolean): Promise<ActionResult> {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { reminders: enabled } });
  revalidatePath("/profil");
  return success(enabled ? "Pengingat harian aktif." : "Pengingat harian dimatikan.");
}

export async function sendTestPush(): Promise<ActionResult> {
  const user = await requireUser();
  const { sent } = await pushToUsers([user.id], {
    title: "Tes notifikasi",
    body: "Notifikasi Portal Magang di perangkat ini berfungsi.",
    url: "/notifikasi",
    tag: "tes",
  });
  return sent > 0 ? success(`Notifikasi tes dikirim ke ${sent} perangkat.`) : failure("Belum ada perangkat yang terdaftar.");
}
