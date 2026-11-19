import { LogOut, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { logout } from "@/actions/auth";
import type { CurrentUser } from "@/lib/auth";
import { BottomNav, SideNav } from "./nav";
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

export function AppShell({
  user,
  variant,
  children,
}: {
  user: CurrentUser;
  variant: "intern" | "admin";
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1500px] gap-6 p-3 lg:p-6">
      <aside className="sticky top-6 hidden h-[calc(100dvh-3rem)] w-64 shrink-0 flex-col justify-between rounded-card bg-surface p-5 shadow-card lg:flex">
        <div className="space-y-8">
          <Logo />
          {variant === "admin" ? (
            <p className="rounded-full bg-lime px-3 py-1 text-center text-xs font-bold uppercase tracking-wider">
              Mode Admin
            </p>
          ) : null}
          <SideNav variant={variant} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-3xl bg-canvas p-3">
            <Avatar name={user.name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
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
        <header className="mb-6 flex items-center justify-between rounded-card bg-surface p-3 pl-4 shadow-card lg:hidden">
          <Logo />
          <form action={logout}>
            <button
              type="submit"
              aria-label="Keluar"
              className="grid size-10 place-items-center rounded-full bg-canvas text-muted"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </header>
        <main id="konten">{children}</main>
      </div>

      <BottomNav variant={variant} />
    </div>
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
