import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/labels";

export function Card({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={clsx(
        "rounded-card bg-surface p-5 shadow-card sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

const toneClass: Record<Tone, string> = {
  neutral: "bg-canvas text-muted",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-lime/60 text-[#2d4a00]",
  warning: "bg-peach text-[#8a3a10]",
  danger: "bg-rose text-[#a0153f]",
  info: "bg-sky text-[#1c4a8a]",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "light",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "light" | "dark" | "lime" | "brand" | "peach" | "sky";
}) {
  const tones = {
    light: "bg-surface",
    dark: "bg-ink text-white",
    lime: "bg-lime",
    brand: "bg-brand-600 text-white",
    peach: "bg-peach",
    sky: "bg-sky",
  } as const;
  const muted = tone === "dark" || tone === "brand" ? "text-white/70" : "text-ink/60";
  return (
    <div
      className={clsx(
        "flex flex-col justify-between gap-5 rounded-card p-5 shadow-card",
        tones[tone],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={clsx("text-sm font-medium", muted)}>{label}</span>
        {icon ? (
          <span
            className={clsx(
              "grid size-9 place-items-center rounded-full",
              tone === "dark" || tone === "brand" ? "bg-white/15" : "bg-ink/5",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {hint ? <div className={clsx("mt-1 text-xs", muted)}>{hint}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-xl">
        ✦
      </div>
      <p className="font-semibold">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-20 text-2xl" };
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={clsx(
        "grid shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 font-bold text-white",
        sizes[size],
      )}
    >
      {initials}
    </span>
  );
}

export const btn = {
  base: "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
  primary: "bg-ink text-white hover:bg-ink/85",
  brand: "bg-brand-600 text-white hover:bg-brand-700",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
  ghost: "bg-transparent text-ink hover:bg-canvas",
  danger: "bg-rose text-[#a0153f] hover:bg-rose/70",
  lime: "bg-lime text-ink hover:bg-lime/80",
};

export function ButtonLink({
  href,
  variant = "primary",
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: keyof Omit<typeof btn, "base">;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(btn.base, btn[variant], className)}
      {...props}
    />
  );
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-canvas/60 px-4 py-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 disabled:opacity-60";

/**
 * Tabel responsif. Di layar lebar: tabel biasa dengan scroll ke samping.
 * Di HP (< md): setiap baris tampil sebagai kartu; sel pakai `label` (judul kolom),
 * sel pertama `primary` menjadi judul kartu, dan sel `actions` ditaruh di bawah.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("md:-mx-2 md:overflow-x-auto md:px-2", className)}>
      <table
        className={clsx(
          "w-full text-left text-sm md:min-w-[640px]",
          "max-md:block max-md:[&_thead]:hidden max-md:[&_tbody]:flex max-md:[&_tbody]:flex-col max-md:[&_tbody]:gap-3",
          "max-md:[&_tbody>tr]:block max-md:[&_tbody>tr]:rounded-3xl max-md:[&_tbody>tr]:border max-md:[&_tbody>tr]:border-line max-md:[&_tbody>tr]:bg-canvas/40 max-md:[&_tbody>tr]:px-4 max-md:[&_tbody>tr]:py-3",
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={clsx(
        "sticky top-0 z-10 whitespace-nowrap bg-surface px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  label,
  primary,
  actions,
}: {
  children?: ReactNode;
  className?: string;
  /** Judul kolom, ditampilkan di samping nilai pada tampilan kartu (HP). */
  label?: string;
  /** Sel judul kartu di HP. */
  primary?: boolean;
  /** Sel tombol aksi; di HP ditaruh di bawah kartu, rata kanan. */
  actions?: boolean;
}) {
  return (
    <td
      className={clsx(
        "border-t border-line px-3 py-3 align-middle",
        "max-md:border-0 max-md:px-0",
        primary
          ? "max-md:block max-md:pb-2 max-md:pt-0 max-md:text-base"
          : actions
            ? "max-md:mt-1 max-md:flex max-md:justify-end max-md:border-t max-md:border-line max-md:pb-0 max-md:pt-3 max-md:text-right"
            : "max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 max-md:py-1.5 max-md:text-right",
        className,
      )}
    >
      {label && !primary && !actions ? (
        <span className="shrink-0 text-left text-xs font-medium text-muted md:hidden">{label}</span>
      ) : null}
      {label && !primary && !actions ? <span className="min-w-0 max-md:break-words">{children}</span> : children}
    </td>
  );
}
