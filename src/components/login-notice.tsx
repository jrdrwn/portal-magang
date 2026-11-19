"use client";

import { useSearchParams } from "next/navigation";

export function LoginNotice() {
  const expired = useSearchParams().get("expired");
  if (!expired) return null;
  return (
    <p role="status" className="mb-6 rounded-2xl bg-sky px-4 py-3 text-sm font-medium text-[#1c4a8a]">
      Sesi Anda berakhir. Silakan masuk lagi.
    </p>
  );
}
