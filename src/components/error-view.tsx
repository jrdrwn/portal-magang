"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { btn } from "./ui/ui";

/** Tampilan error bersama untuk error.tsx. */
export function ErrorView({ error, retry }: { error: unknown; retry: () => void }) {
  // Di production, pesan error server disamarkan; digest dipakai untuk mencocokkan log server.
  const digest =
    error instanceof Error && "digest" in error ? String((error as { digest?: string }).digest) : null;

  return (
    <div role="alert" className="grid min-h-[60dvh] place-items-center px-6 py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-rose text-2xl">!</div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Terjadi kesalahan</h1>
        <p className="mt-2 text-sm text-muted">
          Halaman gagal dimuat. Biasanya karena koneksi ke server atau database terputus sebentar.
          Coba lagi beberapa saat.
        </p>
        {digest ? <p className="mt-3 font-mono text-xs text-muted">Kode: {digest}</p> : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className={`${btn.base} ${btn.primary}`}>
            <RotateCw className="size-4" aria-hidden />
            Coba lagi
          </button>
          <Link href="/" className={`${btn.base} ${btn.soft}`}>
            Ke beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
