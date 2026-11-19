import { CalendarRange, ListChecks, MapPin, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { Logo } from "@/components/shell";
import { OpenTeams, OpenTeamsSkeleton } from "@/components/open-teams";
import { ButtonLink } from "@/components/ui/ui";

const features = [
  {
    icon: MapPin,
    title: "Absensi lokasi",
    text: "Absen masuk dan pulang hanya bisa dilakukan di radius kantor, lengkap dengan titik koordinat.",
    bg: "bg-sky",
  },
  {
    icon: ListChecks,
    title: "Aktivitas harian",
    text: "Catat pekerjaan setelah absen. Izin atau sakit otomatis tercatat sebagai tidak bekerja.",
    bg: "bg-lime",
  },
  {
    icon: CalendarRange,
    title: "Periode magang",
    text: "Daftar dengan tanggal mulai dan selesai, lalu pantau progres magang Anda.",
    bg: "bg-peach",
  },
  {
    icon: ShieldCheck,
    title: "Monitoring admin",
    text: "Admin memantau kehadiran, aktivitas, dan menyetujui pendaftaran dalam satu tempat.",
    bg: "bg-rose",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <header className="flex items-center justify-between rounded-full bg-surface p-2 pl-4 shadow-card">
        <Logo />
        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost">
            Masuk
          </ButtonLink>
          <ButtonLink href="/daftar">Daftar</ButtonLink>
        </div>
      </header>

      <section className="grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div>
          <span className="inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Program magang
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Magang lebih rapi,
            <br />
            <span className="text-brand-600">dari absen sampai laporan.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Satu portal untuk mendaftar, absen berbasis lokasi, mencatat
            aktivitas harian, dan dipantau admin.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/daftar" variant="brand" className="px-7 py-3.5">
              Mulai daftar
            </ButtonLink>
            <ButtonLink href="/login" variant="soft" className="px-7 py-3.5">
              Saya sudah punya akun
            </ButtonLink>
          </div>
        </div>

        <div aria-hidden className="relative mx-auto w-full max-w-md">
          <div className="rounded-[2.25rem] bg-ink p-6 text-white shadow-2xl shadow-brand-600/20">
            <p className="text-sm text-white/60">Kamis, 19 November</p>
            <p className="mt-1 text-5xl font-bold tracking-tight">07:52</p>
            <div className="mt-6 flex items-center gap-3 rounded-3xl bg-white/10 p-4">
              <span className="grid size-11 place-items-center rounded-full bg-lime text-ink">
                <MapPin className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Dalam jangkauan kantor</p>
                <p className="text-xs text-white/60">42 m dari titik absen</p>
              </div>
            </div>
            <div className="pulse-ring mt-6 rounded-full bg-brand-500 py-4 text-center font-semibold">
              Absen masuk
            </div>
          </div>
          <div className="absolute -bottom-6 -left-4 rounded-3xl bg-surface p-4 shadow-card sm:-left-10">
            <p className="text-xs text-muted">Kehadiran bulan ini</p>
            <p className="text-2xl font-bold">96%</p>
          </div>
        </div>
      </section>

      <section className="pb-14" aria-labelledby="tim-terbuka">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="tim-terbuka" className="text-2xl font-bold tracking-tight">
              Tim yang membuka magang
            </h2>
            <p className="mt-1 text-sm text-muted">
              Tersedia jalur Mandiri dan MagangHub (khusus lulusan).
            </p>
          </div>
          <ButtonLink href="/daftar" variant="soft">
            Daftar ke tim
          </ButtonLink>
        </div>
        <Suspense fallback={<OpenTeamsSkeleton />}>
          <OpenTeams />
        </Suspense>
      </section>

      <section className="grid gap-4 pb-14 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, text, bg }) => (
          <div key={title} className={`rounded-card p-6 ${bg}`}>
            <span className="grid size-11 place-items-center rounded-full bg-white/70">
              <Icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-8 text-lg font-bold">{title}</h2>
            <p className="mt-2 text-sm text-ink/70">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
