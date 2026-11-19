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
  idPrefix: string;
}>({ result: null, pending: false, idPrefix: "" });

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
  idPrefix = "",
}: {
  idPrefix?: string;
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
    <FormContext value={{ result, pending, idPrefix }}>
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
  const { result, idPrefix } = useContext(FormContext);
  const { label, name, hint, className, as = "input", ...rest } = props;
  const errors = result?.fieldErrors?.[name];
  const id = `${idPrefix}f-${name}`;
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

/** Pilihan berbentuk kartu (radio). */
export function ChoiceGroup({
  label,
  name,
  options,
  defaultValue,
  onChange,
  columns = 2,
}: {
  label: string;
  name: string;
  options: { value: string; label: string; description?: string | null }[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  columns?: 1 | 2 | 3;
}) {
  const { result, idPrefix } = useContext(FormContext);
  const errors = result?.fieldErrors?.[name];
  const errId = `${idPrefix}f-${name}-err`;
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[columns];

  return (
    <fieldset aria-describedby={errors?.length ? errId : undefined}>
      <legend className="mb-1.5 block text-sm font-semibold">{label}</legend>
      <div className={clsx("grid gap-2", cols)}>
        {options.map((o) => (
          <label
            key={o.value}
            className={clsx(
              "flex cursor-pointer items-start gap-3 rounded-2xl border bg-canvas/60 p-3.5 transition",
              "has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:ring-4 has-checked:ring-brand-100",
              "has-focus-visible:outline-2 has-focus-visible:outline-brand-500",
              errors?.length ? "border-[#e0527a]" : "border-line hover:border-brand-200",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              onChange={(e) => e.target.checked && onChange?.(o.value)}
              className="mt-0.5 size-4 accent-brand-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{o.label}</span>
              {o.description ? (
                <span className="mt-0.5 block text-xs text-muted">{o.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {errors?.length ? (
        <p id={errId} className="mt-1.5 text-xs font-medium text-[#a0153f]">
          {errors[0]}
        </p>
      ) : null}
    </fieldset>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  const { idPrefix } = useContext(FormContext);
  const id = `${idPrefix}f-${name}`;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 rounded accent-brand-600"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Pesan error validasi untuk field tertentu di ActionForm terdekat. */
export function useFieldError(name: string) {
  return useContext(FormContext).result?.fieldErrors?.[name]?.[0];
}
