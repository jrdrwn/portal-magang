"use client";

import clsx from "clsx";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";

type Item = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 60_000;

export function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(iso));
}

export function NotificationBell({ allHref }: { allHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Popover di-portal ke <body> dengan position:fixed: sidebar sticky membuat stacking context
  // sendiri dan bisa di-scroll, jadi popover di dalamnya akan tertutup konten utama.
  function place() {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(352, window.innerWidth - 24);
    const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12);
    setPos({ top: r.bottom + 8, left });
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifikasi", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Item[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Abaikan: dicoba lagi pada polling berikutnya.
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  async function openItem(n: Item) {
    setOpen(false);
    if (!n.readAt) {
      setItems((list) => list.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)));
      setUnread((u) => Math.max(0, u - 1));
      await markNotificationRead(n.id);
    }
    if (n.href) router.push(n.href);
  }

  async function readAll() {
    setItems((list) => list.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
    setUnread(0);
    await markAllNotificationsRead();
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => {
          if (!open) {
            place();
            load();
          }
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
        className="relative grid size-10 place-items-center rounded-full bg-canvas text-ink transition hover:bg-brand-50"
      >
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-[#e0527a] px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open && pos
        ? createPortal(
        <div
          ref={panel}
          role="dialog"
          aria-label="Notifikasi"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[60] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-line bg-white shadow-[0_16px_50px_rgb(21_20_31/0.18)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-sm font-bold">Notifikasi</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={readAll}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Tandai semua dibaca
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Belum ada notifikasi.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto p-1.5">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className="flex w-full gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-canvas"
                  >
                    <span
                      aria-hidden
                      className={clsx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-600")}
                    />
                    <span className="min-w-0">
                      <span className={clsx("block text-sm", n.readAt ? "font-medium text-ink/80" : "font-semibold")}>
                        {n.title}
                      </span>
                      <span className="block text-xs text-muted">{n.body}</span>
                      <span className="mt-0.5 block text-[11px] text-muted/80">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={allHref}
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-brand-700 hover:bg-canvas"
          >
            Lihat semua
          </Link>
        </div>,
          document.body,
        )
        : null}
    </div>
  );
}
