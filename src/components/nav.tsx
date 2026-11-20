"use client";

import clsx from "clsx";
import {
  Award,
  Bell,
  CalendarOff,
  CalendarRange,
  ClipboardList,
  GraduationCap,
  History,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MapPin,
  MessageSquareHeart,
  Settings,
  Shield,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useRef } from "react";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  superOnly?: boolean;
  /** Urutan di navigasi bawah HP (fitur harian). Tanpa nilai = hanya di lembar Menu. */
  pinned?: number;
  /** Tombol utama yang ditonjolkan di tengah navigasi bawah. */
  primary?: boolean;
};

type Group = { label?: string; items: Item[] };

const groups = {
  intern: [
    { items: [{ href: "/dashboard", label: "Beranda", icon: LayoutDashboard, pinned: 1 }] },
    {
      label: "Kehadiran",
      items: [
        { href: "/absensi", label: "Absensi", icon: MapPin, pinned: 3, primary: true },
        { href: "/aktivitas", label: "Aktivitas", icon: ListChecks, pinned: 2 },
      ],
    },
    {
      label: "Magang",
      items: [
        { href: "/pendaftaran", label: "Pendaftaran", icon: CalendarRange },
        { href: "/evaluasi", label: "Evaluasi", icon: Award },
        { href: "/sertifikat", label: "Sertifikat", icon: GraduationCap },
      ],
    },
    {
      label: "Akun",
      items: [
        { href: "/notifikasi", label: "Notifikasi", icon: Bell, pinned: 4 },
        { href: "/profil", label: "Profil", icon: UserRound },
      ],
    },
  ],
  admin: [
    { items: [{ href: "/admin", label: "Ringkasan", icon: LayoutDashboard, exact: true, pinned: 1 }] },
    {
      label: "Peserta",
      items: [
        { href: "/admin/pendaftaran", label: "Pendaftaran", icon: ClipboardList, pinned: 4 },
        { href: "/admin/peserta", label: "Peserta", icon: Users },
      ],
    },
    {
      label: "Kehadiran",
      items: [
        { href: "/admin/absensi", label: "Absensi", icon: MapPin, pinned: 2 },
        { href: "/admin/aktivitas", label: "Aktivitas", icon: ListChecks, pinned: 3 },
      ],
    },
    {
      label: "Penilaian",
      items: [
        { href: "/admin/evaluasi", label: "Evaluasi", icon: Award },
        { href: "/admin/survei", label: "Survei", icon: MessageSquareHeart },
      ],
    },
    {
      label: "Pengelolaan",
      items: [
        { href: "/admin/tim", label: "Tim", icon: UsersRound, superOnly: true },
        { href: "/admin/libur", label: "Hari libur", icon: CalendarOff, superOnly: true },
        { href: "/admin/akun", label: "Akun admin", icon: Shield, superOnly: true },
        { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings, superOnly: true },
        { href: "/admin/log", label: "Log admin", icon: History },
      ],
    },
  ],
} satisfies Record<string, Group[]>;

type NavProps = { variant: keyof typeof groups; superAdmin?: boolean };

/** Grup yang terlihat oleh peran ini; grup tanpa item disembunyikan. */
function visibleGroups({ variant, superAdmin }: NavProps): Group[] {
  return (groups[variant] as Group[])
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.superOnly || superAdmin) }))
    .filter((g) => g.items.length > 0);
}

function isActive(item: Item, pathname: string | null) {
  if (pathname == null) return false;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SideLink({ item, active, onNavigate }: { item: Item; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition",
        active ? "bg-ink text-white shadow-lg shadow-ink/20" : "text-muted hover:bg-canvas hover:text-ink",
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
      {item.label}
    </Link>
  );
}

function GroupList({
  list,
  pathname,
  onNavigate,
}: {
  list: Group[];
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {list.map((g, i) => {
        const id = g.label ? `nav-${g.label.toLowerCase()}` : undefined;
        return (
          <div key={g.label ?? i} role="group" aria-labelledby={id}>
            {g.label ? (
              <p id={id} className="mb-1 px-4 text-[11px] font-bold uppercase tracking-wider text-muted/70">
                {g.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((item) => (
                <li key={item.href}>
                  <SideLink item={item} active={isActive(item, pathname)} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ActiveGroupList({ list, onNavigate }: { list: Group[]; onNavigate?: () => void }) {
  return <GroupList list={list} pathname={usePathname()} onNavigate={onNavigate} />;
}

// Di rute dinamis URL baru diketahui saat request; menu tetap tampil di shell tanpa penanda aktif.
export function SideNav(props: NavProps) {
  const list = visibleGroups(props);
  return (
    <nav aria-label="Menu utama">
      <Suspense fallback={<GroupList list={list} pathname={null} />}>
        <ActiveGroupList list={list} />
      </Suspense>
    </nav>
  );
}

function TabLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  if (item.primary) {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1 text-[11px] font-semibold"
      >
        <span
          className={clsx(
            "-mt-6 grid size-14 place-items-center rounded-full shadow-lg ring-4 ring-surface transition",
            active ? "bg-ink text-white shadow-ink/30" : "bg-brand-600 text-white shadow-brand-600/30",
          )}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <span className={clsx("max-w-full truncate", active ? "text-ink" : "text-brand-700")}>{item.label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold transition",
        active ? "bg-ink text-white" : "text-muted",
      )}
    >
      <Icon className="size-5" aria-hidden />
      <span className="max-w-full truncate">{item.label}</span>
    </Link>
  );
}

function Tabs({ pinned, pathname }: { pinned: Item[]; pathname: string | null }) {
  return pinned.map((item) => <TabLink key={item.href} item={item} active={isActive(item, pathname)} />);
}

function ActiveTabs({ pinned }: { pinned: Item[] }) {
  return <Tabs pinned={pinned} pathname={usePathname()} />;
}

/** Tombol "Menu" aktif saat halaman sekarang bukan salah satu tab yang disematkan. */
function MenuButtonState({ pinned, all }: { pinned: Item[]; all: Item[] }) {
  const pathname = usePathname();
  const inMenu = all.some((i) => isActive(i, pathname)) && !pinned.some((i) => isActive(i, pathname));
  return inMenu ? <span aria-hidden className="absolute right-3 top-2 size-1.5 rounded-full bg-brand-500" /> : null;
}

/** Navigasi bawah (HP): beberapa menu utama + lembar "Menu" berisi semua grup. */
export function BottomNav(props: NavProps) {
  const list = visibleGroups(props);
  const all = list.flatMap((g) => g.items);
  const pinned = all.filter((i) => i.pinned).sort((a, b) => a.pinned! - b.pinned!).slice(0, 4);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  return (
    <>
      <nav
        aria-label="Menu utama"
        className="fixed inset-x-3 bottom-3 z-30 flex gap-1 rounded-3xl bg-surface p-1.5 shadow-[0_10px_40px_rgb(21_20_31/0.15)] lg:hidden"
      >
        <Suspense fallback={<Tabs pinned={pinned} pathname={null} />}>
          <ActiveTabs pinned={pinned} />
        </Suspense>
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          aria-haspopup="dialog"
          className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold text-muted transition"
        >
          <LayoutGrid className="size-5" aria-hidden />
          <span>Menu</span>
          <Suspense fallback={null}>
            <MenuButtonState pinned={pinned} all={all} />
          </Suspense>
        </button>
      </nav>

      <dialog
        ref={dialog}
        aria-label="Semua menu"
        onClick={(e) => e.target === dialog.current && close()}
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-[2rem] bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 lg:hidden"
      >
        <div className="sticky top-0 flex items-center justify-between bg-surface px-5 pb-2 pt-4">
          <p className="text-base font-bold">Menu</p>
          <button
            type="button"
            onClick={close}
            aria-label="Tutup menu"
            className="grid size-10 place-items-center rounded-full bg-canvas text-muted"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Suspense fallback={<GroupList list={list} pathname={null} onNavigate={close} />}>
            <ActiveGroupList list={list} onNavigate={close} />
          </Suspense>
        </div>
      </dialog>
    </>
  );
}
