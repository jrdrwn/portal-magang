"use client";

import clsx from "clsx";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

/** Tombol salin kecil dengan umpan balik "Tersalin". */
export function CopyButton({ value, label = "Salin", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard ditolak (mis. bukan HTTPS): biarkan pengguna menyalin manual.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Tersalin" : `${label} ${value}`}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition duration-200 active:scale-95",
        copied ? "bg-lime text-ink" : "bg-white/70 text-ink hover:bg-white",
        className,
      )}
    >
      <span key={String(copied)} className="inline-flex animate-pop-in">
        {copied ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </span>
      <span aria-live="polite">{copied ? "Tersalin" : label}</span>
    </button>
  );
}
