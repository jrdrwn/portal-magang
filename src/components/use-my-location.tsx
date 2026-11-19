"use client";

import { Loader2, LocateFixed } from "lucide-react";
import { useState } from "react";
import { btn } from "./ui/ui";

/** Mengisi input latitude/longitude (id `f-latitude`, `f-longitude`) dari GPS perangkat admin. */
export function UseMyLocation() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  function fill() {
    if (!("geolocation" in navigator)) {
      setState("error");
      return;
    }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = document.getElementById("f-latitude") as HTMLInputElement | null;
        const lng = document.getElementById("f-longitude") as HTMLInputElement | null;
        if (lat) lat.value = pos.coords.latitude.toFixed(6);
        if (lng) lng.value = pos.coords.longitude.toFixed(6);
        setState("idle");
      },
      () => setState("error"),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={fill}
        disabled={state === "loading"}
        className={`${btn.base} ${btn.soft}`}
      >
        {state === "loading" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <LocateFixed className="size-4" aria-hidden />
        )}
        Pakai lokasi saya
      </button>
      {state === "error" ? (
        <span role="alert" className="text-xs font-medium text-[#a0153f]">
          Tidak bisa membaca lokasi. Periksa izin lokasi browser.
        </span>
      ) : null}
    </span>
  );
}
