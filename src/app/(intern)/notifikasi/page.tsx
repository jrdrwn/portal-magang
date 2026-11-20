import type { Metadata } from "next";
import { NotificationList } from "@/components/notification-list";
import { requireIntern } from "@/lib/auth";

export const metadata: Metadata = { title: "Notifikasi" };

export default async function InternNotificationsPage() {
  const user = await requireIntern();
  return <NotificationList user={user} />;
}
