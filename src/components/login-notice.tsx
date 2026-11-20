"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const COOKIE = "portal_expired";
const hasCookie = () => document.cookie.split("; ").some((c) => c === `${COOKIE}=1`);

export function LoginNotice() {
  const fromUrl = useSearchParams().get("expired") === "1";
  const fromCookie = useSyncExternalStore(
    () => () => {},
    hasCookie,
    () => false,
  );
  const show = fromUrl || fromCookie;

  useEffect(() => {
    if (fromCookie) document.cookie = `${COOKIE}=; Max-Age=0; path=/`;
  }, [fromCookie]);

  if (!show) return null;
  return (
    <p role="status" className="mb-6 rounded-2xl bg-sky px-4 py-3 text-sm font-medium text-[#1c4a8a]">
      Sesi Anda berakhir. Silakan masuk lagi.
    </p>
  );
}
