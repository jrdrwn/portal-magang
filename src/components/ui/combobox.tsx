"use client";

import clsx from "clsx";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type ComboOption = { value: string; label: string; description?: string | null };

/**
 * Dropdown bergaya dengan pola ARIA combobox + listbox.
 * - mode "select": tombol, pilih dari daftar (ketik huruf awal untuk lompat).
 * - mode "search": ketik untuk menyaring, wajib memilih opsi (autocomplete).
 * - mode "free": ketik bebas dengan saran (autocomplete teks).
 * Nilai dikirim lewat input tersembunyi bernama `name`.
 */
export function Combobox({
  id,
  name,
  options,
  defaultValue = "",
  mode = "select",
  placeholder = "Pilih…",
  emptyText = "Tidak ada hasil",
  invalid,
  describedBy,
  ariaLabel,
  className,
  maxLength,
  onValueChange,
}: {
  id?: string;
  name: string;
  options: ComboOption[];
  defaultValue?: string;
  mode?: "select" | "search" | "free";
  placeholder?: string;
  emptyText?: string;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
  className?: string;
  maxLength?: number;
  onValueChange?: (value: string) => void;
}) {
  const autoId = useId();
  const baseId = id ?? `cb-${autoId}`;
  const listId = `${baseId}-list`;

  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState(mode === "free" ? defaultValue : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const root = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const selected = options.find((o) => o.value === value) ?? null;
  const typing = mode !== "select" && open;

  const filtered = useMemo(() => {
    if (mode === "select" || !typing) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q),
    );
  }, [mode, typing, query, options]);

  const shown = mode === "free" ? filtered.slice(0, 8) : filtered;

  // Tutup saat klik di luar.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  });

  // Kembali ke nilai awal saat form di-reset.
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const onReset = () => {
      setValue(defaultValue);
      setQuery(mode === "free" ? defaultValue : "");
      setOpen(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue, mode]);

  useEffect(() => {
    if (!open || active < 0) return;
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function commit(next: string) {
    setValue(next);
    onValueChange?.(next);
  }

  function choose(o: ComboOption) {
    commit(o.value);
    setQuery(mode === "free" ? o.value : "");
    setOpen(false);
    setActive(-1);
  }

  function openList() {
    setOpen(true);
    const idx = shown.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
  }

  function close() {
    setOpen(false);
    setActive(-1);
    if (mode === "search") setQuery("");
  }

  function onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) return openList();
        setActive((i) => Math.min(shown.length - 1, i + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        if (!open) return openList();
        setActive((i) => Math.max(0, i - 1));
        return;
      case "Home":
        if (open && mode === "select") {
          e.preventDefault();
          setActive(0);
        }
        return;
      case "End":
        if (open && mode === "select") {
          e.preventDefault();
          setActive(shown.length - 1);
        }
        return;
      case "Enter":
        if (open && active >= 0 && shown[active]) {
          e.preventDefault();
          choose(shown[active]);
        } else if (!open && mode === "select") {
          e.preventDefault();
          openList();
        }
        return;
      case " ":
        if (mode === "select") {
          e.preventDefault();
          if (open && active >= 0 && shown[active]) choose(shown[active]);
          else openList();
        }
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          close();
        }
        return;
      case "Tab":
        if (open) close();
        return;
      default:
        if (mode === "select" && e.key.length === 1) {
          const now = Date.now();
          const t = typeahead.current;
          t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
          t.at = now;
          const idx = options.findIndex((o) => o.label.toLowerCase().startsWith(t.text));
          if (idx >= 0) {
            if (open) setActive(idx);
            else commit(options[idx].value);
          }
        }
    }
  }

  const activeId = open && active >= 0 && shown[active] ? `${baseId}-opt-${active}` : undefined;
  const fieldClass = clsx(
    "flex w-full items-center gap-2 rounded-2xl border bg-canvas/60 px-4 py-3 text-left text-sm outline-none transition",
    "focus-within:border-brand-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100",
    invalid ? "border-[#e0527a]" : "border-line hover:border-brand-200",
    open && "border-brand-500 bg-white ring-4 ring-brand-100",
  );

  return (
    <div ref={root} className={clsx("relative", className)}>
      <input ref={hidden} type="hidden" name={name} value={mode === "free" ? query : value} />

      {mode === "select" ? (
        <button
          id={baseId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onKeyDown}
          className={fieldClass}
        >
          <span className={clsx("min-w-0 flex-1 truncate", !selected && "text-muted/70")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
      ) : (
        <div className={fieldClass} onClick={() => !open && openList()}>
          {mode === "search" ? <Search className="size-4 shrink-0 text-muted" aria-hidden /> : null}
          <input
            id={baseId}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            aria-label={ariaLabel}
            autoComplete="off"
            maxLength={maxLength}
            value={typing || mode === "free" ? query : (selected?.label ?? "")}
            placeholder={mode === "search" && selected ? selected.label : placeholder}
            onFocus={() => !open && openList()}
            onChange={(e) => {
              setQuery(e.target.value);
              if (mode === "free") commit(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
          />
          <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
        </div>
      )}

      {open && (shown.length > 0 || mode !== "free") ? (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="animate-pop-in absolute inset-x-0 top-full z-50 mt-2 origin-top max-h-64 overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-[0_12px_40px_rgb(21_20_31/0.14)]"
        >
          {shown.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted">{emptyText}</li>
          ) : (
            shown.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${baseId}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={clsx(
                    "flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2.5 text-sm",
                    i === active ? "bg-brand-50 text-brand-700" : "text-ink",
                  )}
                >
                  <Check
                    className={clsx("mt-0.5 size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{o.label}</span>
                    {o.description ? (
                      <span className="block text-xs text-muted">{o.description}</span>
                    ) : null}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
