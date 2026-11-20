import { defineConfig } from "@playwright/test";

// Kunci VAPID khusus tes (bukan rahasia). Server push tiruan di tes memakai sertifikat self-signed,
// karena itu server tes menonaktifkan verifikasi TLS (hanya di proses server e2e).
export const E2E_VAPID = {
  publicKey: "BK9e8hVpjteM9ZYbvCHkbU1Dft01BL966t-fuevapH5nR2o0yGQ4nwM88CqrN26qUSr1_ClJpw9tbA3HtQGXA8U",
  privateKey: "3cKWnV2MBFglVBb4OcmUBFmZ_6IpiwApRRuAHsYAeUg",
};
export const E2E_CRON_SECRET = "e2e-cron-secret";

/**
 * Tes end-to-end. Butuh Postgres KHUSUS TES di E2E_DATABASE_URL (isinya dihapus setiap run).
 *   E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/magang_test npm run test:e2e
 * Opsional: PW_CHROMIUM_PATH (pakai Chromium yang sudah ada), E2E_SKIP_BUILD=1 (lewati `next build`).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 10 * 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE,
    viewport: { width: 1360, height: 900 },
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    // Suite lama berjalan tanpa animasi agar stabil; 10-microinteraction menguji dengan animasi.
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      // Kamera palsu untuk swafoto absen.
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--no-sandbox"],
    },
  },
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? `npx next start -p ${PORT}` : `npx next build && npx next start -p ${PORT}`,
    url: `${BASE}/login`,
    timeout: 5 * 60_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      SESSION_SECRET: "e2e-session-secret-yang-panjang-minimal-32-karakter",
      STORAGE_DIR: ".e2e-storage",
      APP_URL: BASE,
      NEXT_TELEMETRY_DISABLED: "1",
      VAPID_PUBLIC_KEY: E2E_VAPID.publicKey,
      VAPID_PRIVATE_KEY: E2E_VAPID.privateKey,
      VAPID_SUBJECT: "mailto:e2e@magang.local",
      CRON_SECRET: E2E_CRON_SECRET,
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
    },
  },
});
