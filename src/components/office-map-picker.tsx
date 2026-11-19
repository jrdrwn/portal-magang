"use client";

import "leaflet/dist/leaflet.css";
import type { Circle, CircleMarker, Map as LeafletMap } from "leaflet";
import { Loader2, LocateFixed, MousePointerClick } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useFieldError } from "./ui/form";
import { btn } from "./ui/ui";

const MIN_RADIUS = 20;
const MAX_RADIUS = 2000;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Pilih titik kantor dan radius absen langsung di peta:
 * klik peta / geser titik untuk memindahkan lokasi, geser slider untuk radius.
 * Nilai dikirim lewat input tersembunyi latitude, longitude, radiusMeters.
 */
export function OfficeMapPicker({
  latitude,
  longitude,
  radiusMeters,
}: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}) {
  const [pos, setPos] = useState({ lat: latitude, lng: longitude });
  const [radius, setRadius] = useState(radiusMeters);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const circle = useRef<Circle | null>(null);
  const initial = useRef({ latitude, longitude, radiusMeters });

  const latError = useFieldError("latitude");
  const lngError = useFieldError("longitude");
  const radiusError = useFieldError("radiusMeters");

  // Buat peta sekali.
  useEffect(() => {
    let cancelled = false;
    let instance: LeafletMap | null = null;

    import("leaflet").then(({ default: L }) => {
      if (cancelled || !el.current) return;
      const { latitude: lat, longitude: lng, radiusMeters: r } = initial.current;
      instance = L.map(el.current, {
        scrollWheelZoom: false,
        // Area render lebih besar agar lingkaran tidak terpotong saat zoom.
        renderer: L.svg({ padding: 1 }),
      }).setView([lat, lng], 17);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(instance);

      circle.current = L.circle([lat, lng], {
        radius: r,
        color: "#5841f0",
        weight: 2,
        fillColor: "#6a55ff",
        fillOpacity: 0.15,
      }).addTo(instance);

      // Lingkaran kecil sebagai titik (tanpa gambar ikon bawaan Leaflet).
      marker.current = L.circleMarker([lat, lng], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#15141f",
        fillOpacity: 1,
        bubblingMouseEvents: false,
      }).addTo(instance);

      // Geser titik dengan drag.
      let dragging = false;
      marker.current.on("mousedown", () => {
        dragging = true;
        instance?.dragging.disable();
      });
      instance.on("mousemove", (e) => {
        if (!dragging) return;
        marker.current?.setLatLng(e.latlng);
        circle.current?.setLatLng(e.latlng);
      });
      instance.on("mouseup", (e) => {
        if (!dragging) return;
        dragging = false;
        instance?.dragging.enable();
        setPos({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) });
      });
      // Klik di mana saja untuk memindahkan titik.
      instance.on("click", (e) => {
        setPos({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) });
      });

      map.current = instance;
      instance.fitBounds(circle.current.getBounds(), { padding: [24, 24] });
    });

    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
    };
  }, []);

  // Sinkronkan state -> peta.
  useEffect(() => {
    marker.current?.setLatLng([pos.lat, pos.lng]);
    circle.current?.setLatLng([pos.lat, pos.lng]);
  }, [pos]);

  // Saat radius berubah, sesuaikan zoom agar seluruh lingkaran terlihat.
  useEffect(() => {
    if (!circle.current || !map.current) return;
    circle.current.setRadius(radius);
    const t = setTimeout(() => {
      if (circle.current && map.current) {
        map.current.fitBounds(circle.current.getBounds(), { padding: [24, 24], animate: true });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [radius]);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeoError("Browser tidak mendukung geolokasi.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: round6(p.coords.latitude), lng: round6(p.coords.longitude) };
        setPos(next);
        map.current?.setView([next.lat, next.lng], 17);
        setLocating(false);
      },
      () => {
        setGeoError("Tidak bisa membaca lokasi. Periksa izin lokasi browser.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function fitRadius() {
    if (circle.current && map.current) map.current.fitBounds(circle.current.getBounds(), { padding: [24, 24] });
  }

  const error = latError ?? lngError;

  return (
    <div className="space-y-4">
      <input type="hidden" name="latitude" value={pos.lat} />
      <input type="hidden" name="longitude" value={pos.lng} />
      <input type="hidden" name="radiusMeters" value={radius} />

      <div className="relative overflow-hidden rounded-3xl border border-line">
        <div
          ref={el}
          className="h-80 w-full bg-canvas sm:h-96"
          role="application"
          aria-label="Peta lokasi kantor. Klik peta untuk memindahkan titik absen."
        />
        <div className="pointer-events-none absolute left-3 top-3 z-[400] flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold shadow">
          <MousePointerClick className="size-3.5" aria-hidden />
          Klik atau geser titik untuk memindahkan
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Titik: <span className="font-mono font-semibold text-ink">{pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}</span>
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={fitRadius} className={clsx(btn.base, btn.ghost, "px-4 py-2")}>
            Lihat seluruh radius
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className={clsx(btn.base, btn.soft, "px-4 py-2")}
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <LocateFixed className="size-4" aria-hidden />
            )}
            Pakai lokasi saya
          </button>
        </div>
      </div>
      {geoError || error ? (
        <p role="alert" className="text-xs font-medium text-[#a0153f]">
          {geoError ?? error}
        </p>
      ) : null}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="f-radiusMeters" className="text-sm font-semibold">
            Radius absen
          </label>
          <div className="flex items-center gap-1.5">
            <input
              aria-label="Radius dalam meter"
              type="number"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value) || MIN_RADIUS)}
              className="w-20 rounded-xl border border-line bg-canvas/60 px-2 py-1 text-right text-sm font-semibold"
            />
            <span className="text-sm text-muted">m</span>
          </div>
        </div>
        <input
          id="f-radiusMeters"
          type="range"
          min={MIN_RADIUS}
          max={MAX_RADIUS}
          step={10}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-brand-600"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>{MIN_RADIUS} m</span>
          <span>{MAX_RADIUS} m</span>
        </div>
        {radiusError ? (
          <p className="mt-1.5 text-xs font-medium text-[#a0153f]">{radiusError}</p>
        ) : null}
      </div>
    </div>
  );
}
