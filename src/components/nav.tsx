"use client";

import clsx from "clsx";
import {
  Award,
  CalendarRange,
  GraduationCap,
  MessageSquareHeart,
  ClipboardList,
  Shield,
  UsersRound,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  superOnly?: boolean;
};

const items = {
  intern: [
    { href: "/dashboard", label: "Beranda", icon: LayoutDashboard },
    { href: "/absensi", label: "Absensi", icon: MapPin },
    { href: "/aktivitas", label: "Aktivitas", icon: ListChecks },
    { href: "/pendaftaran", label: "Pendaftaran", icon: CalendarRange },
    { href: "/evaluasi", label: "Evaluasi", icon: Award },
    { href: "/sertifikat", label: "Sertifikat", icon: GraduationCap },
    { href: "/profil", label: "Profil", icon: UserRound },
  ],
  admin: [
    { href: "/admin", label: "Ringkasan", icon: LayoutDashboard, exact: true },
    { href: "/admin/pendaftaran", label: "Pendaftaran", icon: ClipboardList },
    { href: "/admin/peserta", label: "Peserta", icon: Users },
    { href: "/admin/absensi", label: "Absensi", icon: MapPin },
    { href: "/admin/aktivitas", label: "Aktivitas", icon: ListChecks },
    { href: "/admin/evaluasi", label: "Evaluasi", icon: Award },
    { href: "/admin/survei", label: "Survei", icon: MessageSquareHeart },
    { href: "/admin/tim", label: "Tim", icon: UsersRound, superOnly: true },
    { href: "/admin/akun", label: "Akun admin", icon: Shield, superOnly: true },
    { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings, superOnly: true },
  ],
} satisfies Record<string, Item[]>;

function isActive(item: Item, pathname: string) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SideLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold transition",
        active
          ? "bg-ink text-white shadow-lg shadow-ink/20"
          : "text-muted hover:bg-canvas hover:text-ink",
      )}
    >
      <Icon className="size-5" aria-hidden />
      {item.label}
    </Link>
  );
}

function TabLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-w-16 flex-1 shrink-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold transition",
        active ? "bg-ink text-white" : "text-muted",
      )}
    >
      <Icon className="size-5" aria-hidden />
      <span className="max-w-full truncate">{item.label}</span>
    </Link>
  );
}

type NavProps = { variant: keyof typeof items; superAdmin?: boolean };

const visible = ({ variant, superAdmin }: NavProps) =>
  (items[variant] as Item[]).filter((i) => !i.superOnly || superAdmin);

function SideLinks({ list, pathname }: { list: Item[]; pathname: string | null }) {
  return list.map((item) => (
    <SideLink key={item.href} item={item} active={pathname != null && isActive(item, pathname)} />
  ));
}

function TabLinks({ list, pathname }: { list: Item[]; pathname: string | null }) {
  return list.map((item) => (
    <TabLink key={item.href} item={item} active={pathname != null && isActive(item, pathname)} />
  ));
}

function ActiveSideLinks({ list }: { list: Item[] }) {
  return <SideLinks list={list} pathname={usePathname()} />;
}

function ActiveTabLinks({ list }: { list: Item[] }) {
  return <TabLinks list={list} pathname={usePathname()} />;
}

// Di rute dinamis URL baru diketahui saat request; menu tetap tampil di shell tanpa penanda aktif.
export function SideNav(props: NavProps) {
  const list = visible(props);
  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-1">
      <Suspense fallback={<SideLinks list={list} pathname={null} />}>
        <ActiveSideLinks list={list} />
      </Suspense>
    </nav>
  );
}

export function BottomNav(props: NavProps) {
  const list = visible(props);
  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-3 bottom-3 z-30 flex gap-1 overflow-x-auto rounded-3xl bg-surface p-1.5 shadow-[0_10px_40px_rgb(21_20_31/0.15)] [scrollbar-width:none] lg:hidden"
    >
      <Suspense fallback={<TabLinks list={list} pathname={null} />}>
        <ActiveTabLinks list={list} />
      </Suspense>
    </nav>
  );
}
