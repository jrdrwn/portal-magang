"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import type { ActionResult } from "@/lib/action-result";
import { btn, inputClass } from "./ui";

const FormContext = createContext<{
  result: ActionResult | null;
  pending: boolean;
}>({ result: null, pending: false });

export function FormMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok && result.message) {
    return (
      <p
        role="status"
        className="rounded-2xl bg-lime/50 px-4 py-3 text-sm font-medium text-[#2d4a00]"
      >
        {result.message}
      </p>
    );
  }
  if (!result.ok && result.error) {
    return (
      <p
        role="alert"
        className="rounded-2xl bg-rose px-4 py-3 text-sm font-medium text-[#a0153f]"
      >
        {result.error}
      </p>
    );
  }
  return null;
}

type FormAction = (formData: FormData) => Promise<ActionResult>;

/**
 * Form dengan Server Action. Isian tidak direset saat validasi gagal.
 * `resetOnSuccess` mengosongkan form setelah berhasil.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  variant = "primary",
  resetOnSuccess = false,
  className,
  submitClassName,
  extra,
}: {
  action: FormAction;
  children: ReactNode;
  submitLabel: string;
  variant?: "primary" | "brand" | "lime";
  resetOnSuccess?: boolean;
  className?: string;
  submitClassName?: string;
  extra?: ReactNode;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <FormContext value={{ result, pending }}>
      <form
        ref={ref}
        noValidate
        className={clsx("space-y-4", className)}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(async () => {
            let res: ActionResult | undefined;
            try {
              res = await action(data);
            } catch {
              res = { ok: false, error: "Terjadi kesalahan. Coba lagi." };
            }
            // Redirect dari action tidak mengembalikan nilai.
            if (res) {
              setResult(res);
              if (res.ok && resetOnSuccess) ref.current?.reset();
            }
          });
        }}
      >
        <FormMessage result={result} />
        {children}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className={clsx(btn.base, btn[variant], submitClassName)}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {submitLabel}
          </button>
          {extra}
        </div>
      </form>
    </FormContext>
  );
}

type FieldProps = {
  label: string;
  name: string;
  hint?: string;
  className?: string;
};

type InputFieldProps = FieldProps &
  Omit<ComponentProps<"input">, "name" | "className"> & { as?: "input" };
type TextareaFieldProps = FieldProps &
  Omit<ComponentProps<"textarea">, "name" | "className"> & { as: "textarea" };
type SelectFieldProps = FieldProps &
  Omit<ComponentProps<"select">, "name" | "className"> & { as: "select" };

export function Field(
  props: InputFieldProps | TextareaFieldProps | SelectFieldProps,
) {
  const { result } = useContext(FormContext);
  const { label, name, hint, className, as = "input", ...rest } = props;
  const errors = result?.fieldErrors?.[name];
  const id = `f-${name}`;
  const describedBy = errors?.length ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const common = {
    id,
    name,
    "aria-invalid": errors?.length ? true : undefined,
    "aria-describedby": describedBy,
    className: clsx(
      inputClass,
      errors?.length && "border-[#e0527a] focus:border-[#e0527a] focus:ring-rose",
    ),
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {as === "textarea" ? (
        <textarea rows={4} {...common} {...(rest as ComponentProps<"textarea">)} />
      ) : as === "select" ? (
        <select {...common} {...(rest as ComponentProps<"select">)} />
      ) : (
        <input {...common} {...(rest as ComponentProps<"input">)} />
      )}
      {errors?.length ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs font-medium text-[#a0153f]">
          {errors[0]}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Tombol yang menjalankan Server Action tanpa form (hapus, aktif/nonaktif, dsb). */
export function ActionButton({
  action,
  children,
  variant = "soft",
  confirmText,
  className,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  variant?: "soft" | "danger" | "ghost" | "primary" | "brand";
  confirmText?: string;
  className?: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={clsx(btn.base, btn[variant], "px-4 py-2", className)}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          startTransition(async () => {
            try {
              setResult(await action());
            } catch {
              setResult({ ok: false, error: "Terjadi kesalahan. Coba lagi." });
            }
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
      {result && !result.ok ? (
        <span role="alert" className="text-xs font-medium text-[#a0153f]">
          {result.error}
        </span>
      ) : null}
    </span>
  );
}
