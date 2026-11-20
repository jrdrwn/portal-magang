import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check, Coffee, Moon } from "lucide-react";
import { requireIntern } from "@/lib/auth";
import { getDailyPlan, type DailyStep } from "@/lib/daily";

const stepTone: Record<DailyStep["state"], string> = {
  done: "bg-lime text-ink",
  current: "bg-brand-600 text-white ring-4 ring-brand-100",
  late: "bg-[#e0527a] text-white ring-4 ring-rose",
  upcoming: "bg-canvas text-muted",
  skipped: "bg-canvas text-muted",
};

function Step({ step, index, last }: { step: DailyStep; index: number; last: boolean }) {
  return (
    <li className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center sm:flex-row sm:items-center sm:gap-3 sm:text-left">
      {!last ? (
        <span
          aria-hidden
          className={clsx(
            "absolute left-[calc(50%+1.25rem)] right-[calc(-50%+1.25rem)] top-4 h-0.5 rounded-full sm:hidden",
            step.state === "done" ? "bg-lime" : "bg-line",
          )}
        />
      ) : null}
      <span
        className={clsx("relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", stepTone[step.state])}
        aria-hidden
      >
        {step.state === "done" ? <Check className="size-4" strokeWidth={3} /> : index + 1}
      </span>
      <span className="min-w-0">
        <span className={clsx("block text-xs font-semibold sm:text-sm", step.state === "upcoming" && "text-muted")}>
          {step.label}
        </span>
        <span className={clsx("block truncate text-[11px] sm:text-xs", step.state === "late" ? "font-semibold text-[#a0153f]" : "text-muted")}>
          {step.detail}
        </span>
      </span>
      <span className="sr-only">
        {step.state === "done" ? "selesai" : step.state === "late" ? "terlambat" : step.state === "current" ? "sekarang" : "nanti"}
      </span>
      {!last ? <span aria-hidden className="hidden h-0.5 flex-1 rounded-full bg-line sm:block" /> : null}
    </li>
  );
}

/** Strip "Langkah hari ini" di atas setiap halaman peserta. */
export async function DailySteps() {
  const user = await requireIntern();
  const plan = await getDailyPlan(user.id);
  if (plan.kind === "none") return null;

  if (plan.kind === "off" || plan.kind === "absent") {
    const Icon = plan.kind === "off" ? Moon : Coffee;
    return (
      <section aria-label="Langkah hari ini" className="mb-6 flex items-center gap-3 rounded-card bg-surface p-4 shadow-card">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky text-[#1c4a8a]">
          <Icon className="size-5" aria-hidden />
        </span>
        <p className="text-sm">
          <span className="font-semibold">Langkah hari ini · </span>
          {plan.kind === "off" ? `${plan.reason} Tidak ada absen hari ini.` : `${plan.label} tercatat. Tidak perlu absen atau mencatat aktivitas hari ini.`}
        </p>
      </section>
    );
  }

  const complete = plan.done === plan.steps.length;
  return (
    <section aria-label="Langkah hari ini" className="mb-6 rounded-card bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold">
          Langkah hari ini{" "}
          <span className={clsx("ml-1 rounded-full px-2 py-0.5 text-xs", complete ? "bg-lime" : "bg-brand-50 text-brand-700")}>
            {plan.done}/{plan.steps.length}
          </span>
        </p>
        {complete ? <p className="text-xs font-semibold text-[#2d4a00]">Semua selesai. Sampai jumpa besok!</p> : null}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <ol className="flex flex-1 items-start gap-2 sm:items-center">
          {plan.steps.map((s, i) => (
            <Step key={s.key} step={s} index={i} last={i === plan.steps.length - 1} />
          ))}
        </ol>
        {plan.next ? (
          <Link
            href={plan.next.href}
            className="flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white transition hover:bg-ink/85 lg:w-72"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{plan.next.label}</span>
              <span className="block truncate text-xs text-white/70">{plan.next.hint}</span>
            </span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function DailyStepsSkeleton() {
  return <div aria-hidden className="mb-6 h-[124px] animate-pulse rounded-card bg-surface lg:h-[92px]" />;
}
