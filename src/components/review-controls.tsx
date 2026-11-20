"use client";

import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { useState, useTransition } from "react";
import { reviewRegistration } from "@/actions/admin";
import type { ActionResult } from "@/lib/action-result";
import { FormMessage } from "./ui/form";
import { btn, inputClass } from "./ui/ui";
import clsx from "clsx";

type Decision = "APPROVED" | "REJECTED" | "PENDING";

export function ReviewControls({
  id,
  status,
}: {
  id: string;
  status: Decision;
}) {
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Decision | null>(null);

  function submit(decision: Decision) {
    const data = new FormData();
    data.set("id", id);
    data.set("decision", decision);
    data.set("note", note.trim());
    setActive(decision);
    startTransition(async () => {
      try {
        setResult(await reviewRegistration(data));
      } catch {
        setResult({ ok: false, error: "Terjadi kesalahan. Coba lagi." });
      }
    });
  }

  const noteError = result?.fieldErrors?.note?.[0];

  return (
    <div className="space-y-3">
      {status === "PENDING" ? (
        <div>
          <label htmlFor={`note-${id}`} className="sr-only">
            Catatan untuk peserta
          </label>
          <input
            id={`note-${id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Catatan untuk peserta (wajib jika menolak)"
            aria-invalid={noteError ? true : undefined}
            className={clsx(inputClass, "py-2.5")}
          />
          {noteError ? (
            <p className="mt-1 text-xs font-medium text-[#a0153f]">{noteError}</p>
          ) : null}
        </div>
      ) : null}

      <FormMessage result={result} />

      <div className="flex flex-wrap gap-2">
        {status === "PENDING" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit("APPROVED")}
              className={clsx(btn.base, btn.lime, "px-4 py-2")}
            >
              {pending && active === "APPROVED" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Setujui
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit("REJECTED")}
              className={clsx(btn.base, btn.danger, "px-4 py-2")}
            >
              {pending && active === "REJECTED" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <X className="size-4" aria-hidden />
              )}
              Tolak
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => submit("PENDING")}
            className={clsx(btn.base, btn.soft, "px-4 py-2")}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RotateCcw className="size-4" aria-hidden />
            )}
            Kembalikan ke menunggu
          </button>
        )}
      </div>
    </div>
  );
}
