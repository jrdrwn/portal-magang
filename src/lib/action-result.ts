import { z } from "zod";

export type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const success = (message?: string): ActionResult => ({
  ok: true,
  message,
});

export const failure = (error: string): ActionResult => ({ ok: false, error });

export function validationFailure(err: z.ZodError): ActionResult {
  return {
    ok: false,
    error: "Periksa kembali isian Anda.",
    fieldErrors: z.flattenError(err).fieldErrors,
  };
}

/** Ambil string dari FormData dengan trim. */
export function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}
