// Semua logika "hari ini" memakai zona waktu WIB.
// Kolom @db.Date disimpan sebagai tengah malam UTC, jadi diformat dengan timeZone "UTC".

export const TIME_ZONE = "Asia/Jakarta";

/** "YYYY-MM-DD" untuk tanggal di WIB. */
export function dateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function keyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function dateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayDate(now: Date = new Date()): Date {
  return keyToDate(dateKey(now));
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const d = keyToDate(value);
  return !Number.isNaN(d.getTime()) && dateToKey(d) === value;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Menit sejak 00:00 WIB. */
export function minutesOfDay(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** "08:15" -> 495 */
export function parseClock(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function isValidClock(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function formatDate(date: Date, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
  }).format(date);
}

export function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "long",
  }).format(date);
}

export function formatTime(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(".", ":");
}

/** Jumlah hari kalender inklusif antara dua tanggal. */
export function daysBetweenInclusive(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}
