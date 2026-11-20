import type { Metadata } from "next";
import { NotificationList } from "@/components/notification-list";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Notifikasi" };

export default async function AdminNotificationsPage() {
  const user = await requireAdmin();
  return <NotificationList user={user} />;
}
