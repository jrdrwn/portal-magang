import Link from "next/link";
import { Logo } from "@/components/shell";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="[&_p]:text-white [&_p:last-child]:text-white/60">
          <Logo />
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Catat kehadiran dan progres magang Anda, tanpa ribet.
          </h2>
          <p className="mt-4 text-white/60">
            Absen berbasis lokasi, aktivitas harian, dan periode magang dalam
            satu tempat.
          </p>
        </div>
        <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/60 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 left-10 size-72 rounded-full bg-lime/30 blur-3xl" />
        <p className="relative z-10 text-sm text-white/40">© Portal Magang</p>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
