"use client";

import clsx from "clsx";
import { BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush, setReminders } from "@/actions/push";
import type { ActionResult } from "@/lib/action-result";
import { FormMessage } from "./ui/form";
import { btn } from "./ui/ui";

type DeviceState = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "unconfigured";

function base64UrlToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function detect(): DeviceState {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIOS && !standalone ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "off";
}

export function ReminderSettings({
  vapidKey,
  remindersEnabled,
  showDailyToggle,
  workStart,
  workEnd,
  dailyDescription,
}: {
  vapidKey: string | null;
  remindersEnabled: boolean;
  showDailyToggle: boolean;
  workStart: string;
  workEnd: string;
  /** Pengganti keterangan pengingat harian (dipakai halaman admin). */
  dailyDescription?: string;
}) {
  const [device, setDevice] = useState<DeviceState>("loading");
  const [daily, setDaily] = useState(remindersEnabled);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!vapidKey) return setDevice("unconfigured");
      const base = detect();
      if (base !== "off") return setDevice(base);
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setDevice(sub ? "on" : "off");
      } catch {
        if (!cancelled) setDevice("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  function run(fn: () => Promise<ActionResult>) {
    setResult(null);
    start(async () => {
      try {
        setResult(await fn());
      } catch {
        setResult({ ok: false, error: "Terjadi kesalahan. Coba lagi." });
      }
    });
  }

  const enable = () =>
    run(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice(permission === "denied" ? "denied" : "off");
        return { ok: false, error: "Izin notifikasi tidak diberikan." };
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(vapidKey!) }));
      const res = await savePushSubscription(sub.toJSON());
      if (res.ok) setDevice("on");
      return res;
    });

  const disable = () =>
    run(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const res = await removePushSubscription(sub.endpoint);
        setDevice("off");
        return res;
      }
      setDevice("off");
      return { ok: true, message: "Notifikasi di perangkat ini dimatikan." };
    });

  const toggleDaily = (next: boolean) => {
    setDaily(next);
    run(async () => {
      const res = await setReminders(next);
      if (!res.ok) setDaily(!next);
      return res;
    });
  };

  const deviceText: Record<DeviceState, string> = {
    loading: "Memeriksa perangkat…",
    unsupported: "Browser ini tidak mendukung notifikasi push. Pengingat tetap muncul di ikon lonceng.",
    "ios-install": "Di iPhone/iPad, tambahkan Portal Magang ke Layar Utama (Bagikan → Tambahkan ke Layar Utama), lalu buka dari ikon itu untuk mengaktifkan notifikasi.",
    denied: "Notifikasi diblokir di browser. Izinkan notifikasi untuk situs ini di pengaturan browser.",
    off: "Aktifkan agar pengingat muncul di HP/laptop ini walau aplikasi sedang ditutup.",
    on: "Notifikasi aktif di perangkat ini.",
    unconfigured: "Notifikasi push belum dikonfigurasi di server (kunci VAPID). Pengingat tetap muncul di ikon lonceng.",
  };

  return (
    <div className="space-y-4">
      <FormMessage result={result} />

      {showDailyToggle ? (
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl bg-canvas/70 p-4">
          <span>
            <span className="block text-sm font-semibold">Pengingat harian</span>
            <span className="block text-xs text-muted">
              {dailyDescription ??
                `Absen masuk (menjelang ${workStart}), catat aktivitas, dan absen pulang (setelah ${workEnd}). Tidak dikirim di hari libur atau saat izin/sakit.`}
            </span>
          </span>
          <span className="relative mt-0.5 inline-flex shrink-0">
            <input
              type="checkbox"
              role="switch"
              checked={daily}
              disabled={pending}
              onChange={(e) => toggleDaily(e.target.checked)}
              aria-label="Pengingat harian"
              className="peer absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-wait"
            />
            <span
              aria-hidden
              className="h-6 w-11 rounded-full bg-line transition-colors duration-200 peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 peer-disabled:opacity-60"
            />
            <span
              aria-hidden
              data-testid="switch-knob"
              className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-spring)] peer-checked:translate-x-5 peer-active:scale-90"
            />
          </span>
        </label>
      ) : null}

      <div className="rounded-2xl bg-canvas/70 p-4">
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              "grid size-10 shrink-0 place-items-center rounded-full",
              device === "on" ? "bg-lime" : "bg-white text-muted",
            )}
          >
            {device === "on" ? <BellRing className="size-5" aria-hidden /> : device === "denied" ? <BellOff className="size-5" aria-hidden /> : <Smartphone className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Notifikasi di perangkat ini</p>
            <p className="text-xs text-muted" data-testid="push-status">
              {deviceText[device]}
            </p>
          </div>
        </div>
        {device === "off" || device === "on" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {device === "off" ? (
              <button type="button" onClick={enable} disabled={pending} className={clsx(btn.base, btn.brand, "px-4 py-2")}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BellRing className="size-4" aria-hidden />}
                Aktifkan notifikasi
              </button>
            ) : (
              <>
                <button type="button" onClick={() => run(sendTestPush)} disabled={pending} className={clsx(btn.base, btn.soft, "px-4 py-2")}>
                  Kirim tes
                </button>
                <button type="button" onClick={disable} disabled={pending} className={clsx(btn.base, btn.ghost, "px-4 py-2")}>
                  Matikan di perangkat ini
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
