"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { success, type ActionResult } from "@/lib/action-result";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return success();
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await requireUser();
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifikasi");
  revalidatePath("/admin/notifikasi");
  return success("Semua notifikasi ditandai dibaca.");
}
