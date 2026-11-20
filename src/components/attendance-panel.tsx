"use client";

import clsx from "clsx";
import { ExternalLink, Loader2, LocateFixed, MapPin, TriangleAlert } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { checkIn, checkOut } from "@/actions/attendance";
import type { ActionResult } from "@/lib/action-result";
import { distanceMeters, formatDistance, mapsUrl } from "@/lib/geo";
import { FormMessage } from "./ui/form";
import { SelfieCapture } from "./selfie-capture";
import { btn } from "./ui/ui";

type Office = {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  workStart: string;
  lateAfter: string;
  workEnd: string;
};

type Position = { lat: number; lng: number; accuracy: number };

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function geoErrorMessage(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) {
    return "Izin lokasi ditolak. Aktifkan izin lokasi di browser lalu muat ulang halaman.";
  }
  if (err.code === err.POSITION_UNAVAILABLE) {
    return "Lokasi tidak tersedia. Pastikan GPS atau koneksi aktif.";
  }
  return "Gagal mendapatkan lokasi (waktu habis). Coba lagi.";
}

export function AttendancePanel({
  office,
  mode,
  blockedReason,
  requireSelfie = false,
  checkInTime,
  checkOutTime,
}: {
  office: Office;
  /** checkin: belum absen · checkout: sudah masuk · done: selesai · blocked: tidak bisa absen */
  mode: "checkin" | "checkout" | "done" | "blocked";
  blockedReason?: string;
  requireSelfie?: boolean;
  checkInTime?: string;
  checkOutTime?: string;
}) {
  const now = useClock();
  const [position, setPosition] = useState<Position | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const tracking = mode === "checkin" || mode === "checkout";
  const [photo, setPhoto] = useState<Blob | null>(null);
  const photoMissing = requireSelfie && !photo;
  const supported = useSyncExternalStore(
    () => () => {},
    () => "geolocation" in navigator,
    () => true,
  );

  useEffect(() => {
    if (!tracking || !supported) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGeoError(null);
        setPosition({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
      },
      (err) => setGeoError(geoErrorMessage(err)),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [tracking, supported]);

  const distance = position
    ? distanceMeters(position.lat, position.lng, office.latitude, office.longitude)
    : null;
  const inRange = distance !== null && distance <= office.radiusMeters;

  function submit() {
    if (!position) return;
    setResult(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("lat", String(position.lat));
      data.set("lng", String(position.lng));
      if (photo) data.set("photo", new File([photo], "swafoto.jpg", { type: "image/jpeg" }));
      try {
        const res = await (mode === "checkin" ? checkIn(data) : checkOut(data));
        setResult(res);
        if (res.ok) setPhoto(null);
      } catch {
        setResult({ ok: false, error: "Terjadi kesalahan. Coba lagi." });
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-card bg-ink text-white shadow-card">
      <div className="p-6 sm:p-8">
        <p className="text-sm text-white/60">
          {now ? dateFmt.format(now) : "\u00a0"}
        </p>
        <p
          className="mt-1 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl"
          aria-label="Waktu sekarang WIB"
        >
          {now ? timeFmt.format(now).replaceAll(".", ":") : "--:--:--"}
          <span className="ml-2 text-base font-medium text-white/50">WIB</span>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-3xl bg-white/10 p-4">
            <p className="text-xs text-white/60">Absen masuk</p>
            <p className="mt-1 text-xl font-semibold">{checkInTime ?? "-"}</p>
          </div>
          <div className="rounded-3xl bg-white/10 p-4">
            <p className="text-xs text-white/60">Absen pulang</p>
            <p className="mt-1 text-xl font-semibold">{checkOutTime ?? "-"}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 bg-white/5 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              "grid size-11 shrink-0 place-items-center rounded-full",
              !tracking
                ? "bg-white/10 text-white/60"
                : inRange
                  ? "bg-lime text-ink"
                  : "bg-peach text-ink",
            )}
          >
            <MapPin className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{office.name}</p>
            <p className="text-white/60">
              Radius absen {office.radiusMeters} m · masuk {office.workStart} ·
              terlambat setelah {office.lateAfter}
            </p>
            <a
              href={mapsUrl(office.latitude, office.longitude)}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex items-center gap-1 text-lime hover:underline"
            >
              Lihat titik kantor <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        </div>

        <FormMessage result={result} />

        {mode === "blocked" ? (
          <p className="flex items-start gap-2 rounded-2xl bg-white/10 p-4 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-peach" aria-hidden />
            {blockedReason}
          </p>
        ) : mode === "done" ? (
          <p className="rounded-2xl bg-lime/20 p-4 text-sm font-medium text-lime">
            Absensi hari ini sudah lengkap. Sampai jumpa besok!
          </p>
        ) : (
          <>
            <div
              className="rounded-2xl bg-white/10 p-4 text-sm"
              aria-live="polite"
            >
              {geoError || !supported ? (
                <p className="flex items-start gap-2 text-peach">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {geoError ?? "Browser Anda tidak mendukung geolokasi."}
                </p>
              ) : !position ? (
                <p className="flex items-center gap-2 text-white/70">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Mencari lokasi Anda…
                </p>
              ) : (
                <p className="flex items-start gap-2">
                  <LocateFixed
                    className={clsx(
                      "mt-0.5 size-4 shrink-0",
                      inRange ? "text-lime" : "text-peach",
                    )}
                    aria-hidden
                  />
                  <span>
                    {inRange ? (
                      <>
                        Anda <b>dalam jangkauan</b> ({formatDistance(distance!)}{" "}
                        dari kantor).
                      </>
                    ) : (
                      <>
                        Anda <b>di luar jangkauan</b> ({formatDistance(distance!)}{" "}
                        dari kantor, maks. {office.radiusMeters} m).
                      </>
                    )}
                    <span className="block text-xs text-white/50">
                      Akurasi GPS ±{Math.round(position.accuracy)} m
                    </span>
                  </span>
                </p>
              )}
            </div>

            {requireSelfie ? <SelfieCapture key={mode} onChange={setPhoto} disabled={pending} /> : null}

            <button
              type="button"
              onClick={submit}
              disabled={!position || !inRange || photoMissing || pending}
              className={clsx(
                btn.base,
                "w-full py-4 text-base",
                mode === "checkin" ? "bg-lime text-ink hover:bg-lime/85" : "bg-brand-500 text-white hover:bg-brand-600",
                inRange && !photoMissing && !pending && "pulse-ring",
              )}
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {mode === "checkin" ? "Absen masuk" : "Absen pulang"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
