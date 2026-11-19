import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  btn,
  inputClass,
} from "@/components/ui/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  dateKey,
  dateToKey,
  formatDate,
  formatTime,
  formatWeekday,
  isValidDateKey,
  keyToDate,
  todayDate,
} from "@/lib/dates";
import { activityLabel } from "@/lib/labels";
import type { ActivityType } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Monitor aktivitas" };

const types: { key: ActivityType | "ALL"; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "WORK", label: "Bekerja" },
  { key: "NOT_WORK", label: "Tidak bekerja" },
];

export default async function AdminActivities({ searchParams }: PageProps<"/admin/aktivitas">) {
  await requireUser("ADMIN");
  const sp = await searchParams;
  const rawDate = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const rawType = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const date = isValidDateKey(rawDate) ? keyToDate(rawDate) : todayDate();
  const type = types.find((t) => t.key === rawType)?.key ?? "ALL";

  const activities = await db.activity.findMany({
    where: { date, ...(type === "ALL" ? {} : { type }) },
    include: { user: { select: { id: true, name: true } }, attendance: true },
    orderBy: [{ user: { name: "asc" } }, { createdAt: "asc" }],
    take: 300,
  });

  const dKey = dateToKey(date);

  return (
    <>
      <PageHeader
        title="Monitor aktivitas"
        description={`${formatWeekday(date)}, ${formatDate(date, "long")} · ${activities.length} aktivitas`}
        action={
          <form className="flex items-center gap-2">
            <input type="hidden" name="type" value={type} />
            <label htmlFor="date" className="sr-only">
              Tanggal
            </label>
            <input
              id="date"
              type="date"
              name="date"
              defaultValue={dKey}
              max={dateKey()}
              className={clsx(inputClass, "w-auto bg-surface py-2.5")}
            />
            <button type="submit" className={clsx(btn.base, btn.primary, "py-2.5")}>
              Lihat
            </button>
          </form>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {types.map((t) => (
          <Link
            key={t.key}
            href={`/admin/aktivitas?date=${dKey}&type=${t.key}`}
            aria-current={type === t.key ? "page" : undefined}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              type === t.key ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activities.length === 0 ? (
        <Card>
          <EmptyState title="Tidak ada aktivitas" description="Belum ada aktivitas pada tanggal dan filter ini." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {activities.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/admin/peserta/${a.user.id}`}
                  className="flex min-w-0 items-center gap-3 hover:underline"
                >
                  <Avatar name={a.user.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{a.user.name}</span>
                    <span className="block text-xs text-muted">
                      {a.attendance.checkInAt
                        ? `Masuk ${formatTime(a.attendance.checkInAt)}`
                        : "Tanpa absen lokasi"}
                    </span>
                  </span>
                </Link>
                <Badge tone={activityLabel[a.type].tone}>{activityLabel[a.type].label}</Badge>
              </div>
              <p className="mt-4 font-semibold">{a.title}</p>
              {a.description ? (
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.description}</p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
