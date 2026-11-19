import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ui";

export const metadata: Metadata = { title: "Halaman tidak ditemukan" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-8xl font-extrabold tracking-tight text-brand-600">404</p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-muted">
          Alamat yang Anda buka tidak ada atau sudah dipindahkan. Data yang bukan milik tim Anda
          juga tampil sebagai tidak ditemukan.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" variant="soft">
            Ke beranda
          </ButtonLink>
          <ButtonLink href="/login">Masuk</ButtonLink>
        </div>
      </div>
    </main>
  );
}
