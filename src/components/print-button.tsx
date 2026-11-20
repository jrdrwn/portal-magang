"use client";

import { Printer } from "lucide-react";
import { btn } from "./ui/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${btn.base} ${btn.brand}`}>
      <Printer className="size-4" aria-hidden />
      Cetak / Simpan PDF
    </button>
  );
}
