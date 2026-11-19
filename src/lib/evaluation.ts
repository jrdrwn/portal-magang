import { addDays, dateKey, keyToDate } from "./dates";
import type { Tone } from "./labels";

export const ASPECTS = [
  { key: "discipline", label: "Kedisiplinan", hint: "Kehadiran, ketepatan waktu, kepatuhan aturan" },
  { key: "workQuality", label: "Kualitas kerja", hint: "Ketelitian dan hasil pekerjaan" },
  { key: "communication", label: "Komunikasi", hint: "Menyampaikan progres dan kendala" },
  { key: "initiative", label: "Inisiatif", hint: "Proaktif belajar dan mencari solusi" },
  { key: "teamwork", label: "Kerja sama", hint: "Kolaborasi dengan tim" },
] as const;

export type AspectKey = (typeof ASPECTS)[number]["key"];
export type Scores = Record<AspectKey, number>;

export function averageScore(e: Scores) {
  const total = ASPECTS.reduce((sum, a) => sum + e[a.key], 0);
  return Math.round((total / ASPECTS.length) * 10) / 10;
}

export function grade(avg: number): { letter: string; label: string; tone: Tone } {
  if (avg >= 85) return { letter: "A", label: "Sangat baik", tone: "success" };
  if (avg >= 70) return { letter: "B", label: "Baik", tone: "brand" };
  if (avg >= 55) return { letter: "C", label: "Cukup", tone: "warning" };
  return { letter: "D", label: "Perlu perbaikan", tone: "danger" };
}

/** "2026-11" untuk bulan berjalan (WIB). */
export function currentMonthKey() {
  return dateKey().slice(0, 7);
}

export function isValidMonthKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function monthStart(key: string) {
  return keyToDate(`${key}-01`);
}

/** Hari terakhir bulan. */
export function monthEnd(key: string) {
  const start = monthStart(key);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return addDays(next, -1);
}

export function shiftMonth(key: string, delta: number) {
  const start = monthStart(key);
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function formatMonth(key: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(monthStart(key));
}
