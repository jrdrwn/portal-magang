import Link from "next/link";
import clsx from "clsx";
import { markAllNotificationsRead } from "@/actions/notifications";
import { ActionButton } from "@/components/ui/form";
import { Card, EmptyState, PageHeader } from "@/components/ui/ui";
import { db } from "@/lib/db";
import { ensureSurveyReminders } from "@/lib/notifications";
import type { CurrentUser } from "@/lib/auth";

const fmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export async function NotificationList({ user }: { user: CurrentUser }) {
  if (user.role === "INTERN") await ensureSurveyReminders(user.id);
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifikasi"
        description={unread ? `${unread} belum dibaca` : "Semua sudah dibaca"}
        action={
          unread ? (
            <ActionButton action={markAllNotificationsRead} variant="soft">
              Tandai semua dibaca
            </ActionButton>
          ) : null
        }
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="Belum ada notifikasi" description="Kabar terbaru tentang magang Anda akan muncul di sini." />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const body = (
                <div className="flex gap-3 py-3.5">
                  <span
                    aria-hidden
                    className={clsx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-line" : "bg-brand-600")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={clsx("text-sm", n.readAt ? "font-medium" : "font-semibold")}>{n.title}</p>
                    <p className="text-sm text-muted">{n.body}</p>
                  </div>
                  <time className="shrink-0 text-xs text-muted" dateTime={n.createdAt.toISOString()}>
                    {fmt.format(n.createdAt).replace(".", ":")}
                  </time>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} className="block rounded-2xl px-2 transition hover:bg-canvas">
                      {body}
                    </Link>
                  ) : (
                    <div className="px-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
