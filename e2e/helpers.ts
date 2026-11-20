import { expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { mkdirSync } from "node:fs";
import pg from "pg";

export const BASE = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
export const OFFICE = { latitude: -6.2088, longitude: 106.8456 };
export const DEMO_PASSWORD = "Demo#12345";

export const shotsDir = (name: string) => {
  const dir = `test-results/shots/${name}`;
  mkdirSync(dir, { recursive: true });
  return dir;
};

/** Pengecekan lunak: semua langkah tetap jalan, kegagalan dilaporkan di akhir. */
export const check = (name: string, ok: unknown, extra = "") =>
  expect.soft(Boolean(ok), `${name}${extra ? ` -> ${extra}` : ""}`).toBe(true);

export async function sql(query: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
  await c.connect();
  try {
    return (await c.query(query, params)).rows;
  } finally {
    await c.end();
  }
}

export async function resetDemoAccounts() {
  await sql(
    `UPDATE "User" SET "passwordHash"=$1, "passwordChangedAt"=NULL, "isActive"=true WHERE email LIKE '%@demo.local'`,
    [bcrypt.hashSync(DEMO_PASSWORD, 10)],
  );
  await sql(`UPDATE "User" SET reminders=true`);
  await sql(`DELETE FROM "AuthAttempt"`);
}

export const dateKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
export const plusDays = (n: number) => dateKey(new Date(Date.now() + n * 86_400_000));

export async function newSession(
  browser: Browser,
  viewport = { width: 1360, height: 900 },
  geo = OFFICE,
  { reducedMotion = "reduce" }: { reducedMotion?: "reduce" | "no-preference" } = {},
) {
  const ctx = await browser.newContext({ viewport, permissions: ["geolocation", "camera"], geolocation: geo, reducedMotion });
  const page = await ctx.newPage();
  return { ctx, page };
}

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.fill("#f-email", email);
  await page.fill("#f-password", password);
  await page.click('form button[type="submit"]');
}

export const loggedIn = (page: Page) =>
  page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });

/** Ambil swafoto dari kamera palsu Chromium. */
export async function takeSelfie(page: Page) {
  await page.getByRole("button", { name: "Buka kamera" }).click();
  await page.getByRole("button", { name: "Ambil foto" }).click();
  await page.getByText("Foto siap dikirim").waitFor();
}

// Berkas kecil yang valid (dikenali dari isinya).
export const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
export const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5f0000000049454e44ae426082",
  "hex",
);

export async function uploadDocs(page: Page, { coverLetter = true } = {}) {
  await page.setInputFiles("#f-cv", { name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
  if (coverLetter) {
    await page.setInputFiles("#f-coverLetter", { name: "surat-pengantar.png", mimeType: "image/png", buffer: PNG });
  }
}
