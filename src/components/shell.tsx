import { LogOut, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/actions/auth";
import type { CurrentUser } from "@/lib/auth";
import { BottomNav, SideNav } from "./nav";
import { NotificationBell } from "./notification-bell";
import { Avatar } from "./ui/ui";

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-10 place-items-center rounded-2xl bg-brand-600 text-white">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight">Portal Magang</p>
        <p className="text-xs text-muted">Intern workspace</p>
      </div>
    </div>
  );
}

export function AccountCard({
  user,
  href,
}: {
  user: Pick<CurrentUser, "name" | "email">;
  href: string;
}) {
  return (
    <Link
      href={href}
      title="Akun saya"
      className="flex items-center gap-3 rounded-3xl bg-canvas p-3 transition hover:bg-brand-50"
    >
      <Avatar name={user.name} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </div>
    </Link>
  );
}

export function AccountCardSkeleton() {
  return (
    <div aria-hidden className="flex items-center gap-3 rounded-3xl bg-canvas p-3">
      <span className="size-10 shrink-0 animate-pulse rounded-full bg-line" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <span className="block h-3.5 w-24 animate-pulse rounded-full bg-line" />
        <span className="block h-3 w-32 animate-pulse rounded-full bg-line" />
      </div>
    </div>
  );
}

export function ShellFrame({
  variant,
  superAdmin = false,
  badge,
  account,
  banner,
  children,
}: {
  variant: "intern" | "admin";
  superAdmin?: boolean;
  badge?: ReactNode;
  account: ReactNode;
  /** Tampil di atas konten setiap halaman (mis. langkah hari ini). */
  banner?: ReactNode;
  children: ReactNode;
}) {
  const notificationsHref = variant === "admin" ? "/admin/notifikasi" : "/notifikasi";
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1500px] gap-6 p-3 lg:p-6">
      <aside className="sticky top-6 hidden h-[calc(100dvh-3rem)] w-64 shrink-0 flex-col gap-4 rounded-card bg-surface p-5 shadow-card lg:flex">
        <div className="flex min-h-0 flex-1 flex-col gap-5">
          <div className="flex items-center justify-between gap-2">
            <Logo />
            <NotificationBell allHref={notificationsHref} />
          </div>
          {badge}
          <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 [scrollbar-width:thin]">
            <SideNav variant={variant} superAdmin={superAdmin} />
          </div>
        </div>

        <div className="space-y-3">
          {account}
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-rose hover:text-[#a0153f]"
            >
              <LogOut className="size-4" aria-hidden />
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-28 lg:pb-6">
        <header className="sticky top-3 z-30 mb-6 flex items-center justify-between rounded-card bg-surface p-3 pl-4 shadow-card lg:hidden">
          <Logo />
          <div className="flex items-center gap-2">
          <NotificationBell allHref={notificationsHref} />
          {variant === "admin" ? (
            <Link
              href="/admin/akun-saya"
              aria-label="Akun saya"
              className="grid size-10 place-items-center rounded-full bg-canvas text-muted"
            >
              <UserRound className="size-4" aria-hidden />
            </Link>
          ) : null}
          <form action={logout}>
            <button
              type="submit"
              aria-label="Keluar"
              className="grid size-10 place-items-center rounded-full bg-canvas text-muted"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
          </div>
        </header>
        {banner}
        <main id="konten">{children}</main>
      </div>

      <BottomNav variant={variant} superAdmin={superAdmin} />
    </div>
  );
}

export function AppShell({
  user,
  variant,
  banner,
  children,
}: {
  user: CurrentUser;
  variant: "intern" | "admin";
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ShellFrame
      variant={variant}
      superAdmin={user.role === "SUPER_ADMIN"}
      badge={
        variant === "admin" ? (
          <div className="rounded-3xl bg-lime px-3 py-2 text-center">
            <p className="text-xs font-bold uppercase tracking-wider">
              {user.role === "SUPER_ADMIN" ? "Admin utama" : "Admin tim"}
            </p>
            {user.role === "TEAM_ADMIN" ? (
              <p className="truncate text-xs font-medium text-ink/70">
                {user.teamName ?? "Belum ada tim"}
              </p>
            ) : null}
          </div>
        ) : null
      }
      account={
        <AccountCard user={user} href={variant === "admin" ? "/admin/akun-saya" : "/profil"} />
      }
      banner={banner}
    >
      {children}
    </ShellFrame>
  );
}

export function ShellSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1500px] gap-6 p-3 lg:p-6">
      <div className="hidden w-64 shrink-0 animate-pulse rounded-card bg-surface lg:block" />
      <div className="flex-1 space-y-4">
        <div className="h-24 animate-pulse rounded-card bg-surface" />
        <div className="h-64 animate-pulse rounded-card bg-surface" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Memuat">
      <div className="h-10 w-64 animate-pulse rounded-2xl bg-surface" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-card bg-surface" />
    </div>
  );
}
