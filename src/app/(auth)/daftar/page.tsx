import type { Metadata } from "next";
import Link from "next/link";
import { registerAccount } from "@/actions/auth";
import { ActionForm, Field } from "@/components/ui/form";

export const metadata: Metadata = { title: "Buat akun" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Buat akun peserta</h1>
      <p className="mb-8 mt-2 text-sm text-muted">
        Setelah itu Anda bisa mengajukan periode magang.
      </p>
      <ActionForm action={registerAccount} submitLabel="Buat akun" submitClassName="w-full py-3.5">
        <Field label="Nama lengkap" name="name" autoComplete="name" required />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Minimal 8 karakter"
          required
        />
        <Field
          label="Ulangi password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Masuk
        </Link>
      </p>
    </>
  );
}
