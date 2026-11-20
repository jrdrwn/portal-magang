import { test, type Page } from "@playwright/test";
import { BASE, check, resetDemoAccounts, shotsDir } from "./helpers";

test.describe.configure({ mode: "serial" });

test("Keamanan & operasional: 404, header, rate limit, sesi, reset, export", async ({ browser }) => {
  await resetDemoAccounts();
  const shots = shotsDir("keamanan");


async function session() {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return { ctx, page };
}
async function login(page: Page, email: string, password = "Demo#12345") {
  await page.goto(`${BASE}/login`);
  await page.fill("#f-email", email);
  await page.fill("#f-password", password);
  await page.click('form button[type="submit"]');
}
const loggedIn = (page: Page) => page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });

  const g = await session();
  // ---------- 404, header, health, metadata ----------
  const r404 = await g.page.goto(`${BASE}/halaman-yang-tidak-ada`);
  await g.page.getByText("Halaman tidak ditemukan").first().waitFor();
  check("404: status 404 & halaman kustom", r404.status() === 404);
  const home = await g.page.goto(BASE);
  const h = home.headers();
  check("header: X-Frame-Options DENY", h["x-frame-options"] === "DENY");
  check("header: Permissions-Policy geolocation & camera (self)", (h["permissions-policy"] ?? "").includes("geolocation=(self), camera=(self)"));
  check("header: X-Powered-By disembunyikan", !h["x-powered-by"]);
  const health = await g.page.request.get(`${BASE}/api/health`);
  check("health: 200 & database ok", health.status() === 200 && (await health.json()).database === "ok");
  const mani = await g.page.request.get(`${BASE}/manifest.webmanifest`);
  check("manifest tersedia", mani.ok() && (await mani.json()).name === "Portal Magang");
  const robots = await (await g.page.request.get(`${BASE}/robots.txt`)).text();
  check("robots.txt menutup /admin", robots.includes("Disallow: /admin"));
  check("ikon tersedia", (await g.page.request.get(`${BASE}/icon.svg`)).ok() && (await g.page.request.get(`${BASE}/icons/icon-512.png`)).ok());

  // ---------- Batas percobaan login ----------
  for (let i = 0; i < 5; i++) {
    await login(g.page, "raka@demo.local", "salah-password");
    await g.page.getByText("Email atau password salah.").waitFor();
  }
  await login(g.page, "raka@demo.local", "salah-password");
  await g.page.getByText("Terlalu banyak percobaan gagal").waitFor();
  check("rate limit: diblokir setelah 5 gagal", true);
  await login(g.page, "raka@demo.local", "Demo#12345");
  await g.page.getByText("Terlalu banyak percobaan gagal").waitFor();
  check("rate limit: password benar pun ditahan selama blokir", g.page.url().includes("/login"));
  await login(g.page, "nadia@demo.local");
  await loggedIn(g.page);
  check("rate limit: email lain tidak ikut terblokir", true);

  // ---------- Ganti password admin: sesi lain keluar, tanpa redirect berputar ----------
  const devA = await session();
  const devB = await session();
  await login(devA.page, "admin.mobile@demo.local"); await loggedIn(devA.page);
  await login(devB.page, "admin.mobile@demo.local"); await loggedIn(devB.page);
  await devA.page.goto(`${BASE}/admin/akun-saya`);
  await devA.page.fill("#name-f-name", "Admin Mobile Baru");
  await devA.page.getByRole("button", { name: "Simpan", exact: true }).click();
  await devA.page.getByText("Nama diperbarui.").waitFor();
  check("akun saya: ganti nama admin", true);
  await devA.page.fill("#f-current", "Demo#12345");
  await devA.page.fill("#f-next", "PasswordBaru1");
  await devA.page.fill("#f-confirm", "PasswordBaru1");
  await devA.page.getByRole("button", { name: "Ganti password" }).click();
  await devA.page.getByText("Password diganti.").waitFor();
  await devA.page.goto(`${BASE}/admin`);
  await devA.page.getByText("Peserta aktif", { exact: true }).waitFor();
  check("ganti password: sesi saat ini tetap masuk", devA.page.url().endsWith("/admin"));
  await devB.page.goto(`${BASE}/admin`);
  await devB.page.waitForURL(/\/login/, { timeout: 15000 });
  await devB.page.getByText("Sesi Anda berakhir").waitFor();
  check("ganti password: sesi perangkat lain keluar (tanpa redirect loop)", true);
  await login(devB.page, "admin.mobile@demo.local", "PasswordBaru1"); await loggedIn(devB.page);
  check("ganti password: password baru bisa dipakai", true);

  // ---------- Reset password oleh admin tim ----------
  const web = await session();
  await login(web.page, "admin.web@demo.local"); await loggedIn(web.page);
  const nadiaId = await (async () => {
    await web.page.goto(`${BASE}/admin/peserta`);
    const href = await web.page.getByRole("link", { name: /Nadia Putri/ }).getAttribute("href");
    return href.split("/").pop();
  })();
  web.page.once("dialog", (d) => d.accept());
  await web.page.goto(`${BASE}/admin/peserta/${nadiaId}`);
  await web.page.getByRole("button", { name: "Reset password" }).click();
  const msg = await web.page.getByText("Password sementara untuk nadia@demo.local").textContent();
  const temp = msg.match(/: (\S+) —/)?.[1];
  check("reset password: password sementara tampil", Boolean(temp), temp);
  await g.page.goto(`${BASE}/dashboard`);
  await g.page.waitForURL(/\/login/);
  await g.page.getByText("Sesi Anda berakhir").waitFor();
  check("reset password: sesi lama peserta keluar", true);
  await login(g.page, "nadia@demo.local", temp); await loggedIn(g.page);
  check("reset password: login dengan password sementara", true);

  // ---------- Export CSV ----------
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const from = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() - 30 * 86400000));
  const csvRes = await web.page.request.get(`${BASE}/admin/export/absensi?from=${from}&to=${today}`);
  const csv = await csvRes.text();
  check("export absensi: CSV terunduh", csvRes.ok() && csvRes.headers()["content-type"].includes("text/csv"));
  check("export absensi: hanya tim sendiri (Nadia ada, Raka tidak)", csv.includes("Nadia Putri") && !csv.includes("Raka Pratama"));
  check("export absensi: BOM + pemisah ;", csv.charCodeAt(0) === 0xfeff && csv.split("\n")[0].includes(";"));
  const bad = await web.page.request.get(`${BASE}/admin/export/absensi?from=2020-01-01&to=${today}`);
  check("export absensi: rentang >93 hari ditolak", bad.status() === 400);
  const lastMonth = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
  const ev = await (await web.page.request.get(`${BASE}/admin/export/evaluasi?month=${lastMonth}`)).text();
  check("export evaluasi: berisi aspek & peserta tim", ev.includes("Kedisiplinan") && ev.includes("Nadia Putri") && !ev.includes("Raka"));
  const asIntern = await g.page.request.get(`${BASE}/admin/export/absensi?from=${from}&to=${today}`);
  check("export: peserta tidak bisa mengunduh", !(asIntern.headers()["content-type"] ?? "").includes("text/csv"));
  await web.page.goto(`${BASE}/admin/absensi`);
  await web.page.getByRole("button", { name: "Unduh CSV" }).waitFor();
  check("tombol export di monitor absensi", true);

  // ---------- Nonaktifkan akun saat sedang login ----------
  const salsa = await session();
  await login(salsa.page, "salsa@demo.local"); await loggedIn(salsa.page);
  const sup = await session();
  await login(sup.page, "admin@magang.local", "Admin#12345"); await loggedIn(sup.page);
  await sup.page.goto(`${BASE}/admin/peserta`);
  await sup.page.getByRole("link", { name: /Salsa Amelia/ }).click();
  await sup.page.waitForURL("**/admin/peserta/*");
  sup.page.once("dialog", (d) => d.accept());
  await sup.page.getByRole("button", { name: "Nonaktifkan akun" }).click();
  await sup.page.getByRole("button", { name: "Aktifkan akun" }).waitFor();
  await salsa.page.goto(`${BASE}/dashboard`);
  await salsa.page.waitForURL(/\/login/, { timeout: 15000 });
  await salsa.page.getByText("Sesi Anda berakhir").waitFor();
  check("akun dinonaktifkan: dikeluarkan tanpa redirect loop", true);

  // ---------- Admin utama reset password admin tim ----------
  await sup.page.goto(`${BASE}/admin/akun`);
  const row = sup.page.locator("li", { hasText: "admin.uiux@demo.local" });
  sup.page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Reset password" }).click();
  await row.getByText("Password sementara untuk admin.uiux@demo.local").waitFor();
  check("admin utama: reset password admin tim", true);
  await sup.page.screenshot({ path: `${shots}/akun-reset.png`, fullPage: true });
  await g.page.goto(`${BASE}/login`);
  await g.page.screenshot({ path: `${shots}/login.png` });
  await r404; await g.page.goto(`${BASE}/tidak-ada`);
  await g.page.screenshot({ path: `${shots}/404.png` });
});
