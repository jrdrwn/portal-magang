import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginNotice } from "@/components/login-notice";
import { login } from "@/actions/auth";
import { ActionForm, Field } from "@/components/ui/form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Selamat datang kembali</h1>
      <p className="mb-8 mt-2 text-sm text-muted">
        Masuk untuk absen dan melihat aktivitas Anda.
      </p>
      <Suspense fallback={null}>
        <LoginNotice />
      </Suspense>
      <ActionForm action={login} submitLabel="Masuk" submitClassName="w-full py-3.5">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nama@email.com"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Password Anda"
          required
        />
      </ActionForm>
      <p className="mt-4 text-center text-sm text-muted">
        Lupa password? Hubungi admin tim atau admin utama untuk reset.
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-semibold text-brand-600 hover:underline">
          Daftar sekarang
        </Link>
      </p>
    </>
  );
}
