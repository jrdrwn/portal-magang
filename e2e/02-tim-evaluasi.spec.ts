import { test, type Page } from "@playwright/test";
import { BASE, OFFICE, check, dateKey, plusDays, resetDemoAccounts, shotsDir, sql, takeSelfie, uploadDocs } from "./helpers";

test.describe.configure({ mode: "serial" });

test("Tim, admin tim, jenis magang, evaluasi, peta", async ({ browser }) => {
  await resetDemoAccounts();
  await sql(`DELETE FROM "User" WHERE email IN ('budi@test.local','admin.qa@test.local')`);
  await sql(`DELETE FROM "Team" WHERE name='QA Testing'`);
  await sql(`DELETE FROM "Attendance" WHERE "userId" IN (SELECT id FROM "User" WHERE email='salsa@demo.local') AND date=CURRENT_DATE`);
  await sql(`UPDATE "OfficeSetting" SET latitude=-6.2088, longitude=106.8456, "radiusMeters"=150 WHERE id=1`);
  const shots = shotsDir("tim");
  const key = (d = new Date()) => dateKey(d);
  const plus = (n: number) => plusDays(n);


async function session(viewport: { width: number; height: number } = { width: 1360, height: 900 }) {
  const ctx = await browser.newContext({ viewport, permissions: ["geolocation", "camera"], geolocation: OFFICE });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return { ctx, page };
}
async function login(page: Page, email: string, password = "Demo#12345") {
  await page.goto(`${BASE}/login`);
  await page.fill("#f-email", email);
  await page.fill("#f-password", password);
  await page.click('main button[type="submit"], form button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

  // ---------- Landing: tim terbuka ----------
  const guest = await session();
  await guest.page.goto(BASE);
  await guest.page.getByText("Tim yang membuka magang").waitFor();
  await guest.page.getByText("Web Development").first().waitFor();
  check("landing: tim terbuka tampil", true);
  check("landing: tim tertutup (Data Analyst) tidak tampil", (await guest.page.getByText("Data Analyst").count()) === 0);
  await guest.page.screenshot({ path: `${shots}/landing.png`, fullPage: true });
  await guest.page.goto(`${BASE}/daftar`);
  await guest.page.getByText("Tim yang membuka pendaftaran").waitFor();
  await guest.page.getByText("UI/UX Design").first().waitFor();
  check("daftar akun: daftar tim terbuka tampil", true);
  await guest.page.screenshot({ path: `${shots}/daftar.png` });

  // ---------- Peserta: daftar akun & pendaftaran ----------
  await guest.page.fill("#f-name", "Budi Tester");
  await guest.page.fill("#f-email", "budi@test.local");
  await guest.page.fill("#f-password", "Rahasia123");
  await guest.page.fill("#f-confirm", "Rahasia123");
  await guest.page.click('form button[type="submit"]');
  await guest.page.waitForURL("**/pendaftaran");
  const p = guest.page;
  const budiCtx = guest.ctx;
  check("peserta: akun dibuat", true);

  check("pendaftaran: tim tertutup tidak bisa dipilih", (await p.getByRole("radio", { name: /Data Analyst/ }).count()) === 0);
  await p.getByRole("radio", { name: /MagangHub/ }).check();
  await p.locator("#f-graduationYear").waitFor();
  check("pendaftaran: pilih MagangHub memunculkan tahun lulus", true);
  await p.getByRole("radio", { name: /Web Development/ }).check();
  await p.fill("#f-startDate", key());
  await p.fill("#f-endDate", plus(60));
  await p.fill("#f-motivation", "Ingin belajar membangun aplikasi web.");
  await uploadDocs(p, { coverLetter: false });
  await p.click('main button[type="submit"]');
  await p.locator("#f-graduationYear-err").waitFor();
  check("pendaftaran: MagangHub tanpa tahun lulus ditolak", true);
  await p.fill("#f-graduationYear", "2025");
  await p.screenshot({ path: `${shots}/pendaftaran-form.png`, fullPage: true });
  await p.click('main button[type="submit"]');
  await p.getByText("Pendaftaran terkirim").waitFor();
  await p.getByText("lulus 2025").first().waitFor();
  check("pendaftaran: terkirim (MagangHub, Web Development)", true);

  // ---------- Admin tim lain tidak melihat ----------
  const mob = await session();
  await login(mob.page, "admin.mobile@demo.local");
  await mob.page.goto(`${BASE}/admin/pendaftaran`);
  await mob.page.getByRole("heading", { name: "Pendaftaran" }).waitFor();
  check("admin tim Mobile: tidak melihat pendaftaran Budi", (await mob.page.getByText("Budi Tester").count()) === 0);
  await mob.page.goto(`${BASE}/admin/peserta`);
  check("admin tim Mobile: peserta tim lain tidak tampil", (await mob.page.getByText("Nadia Putri").count()) === 0 && (await mob.page.getByText("Raka Pratama").count()) > 0);
  await mob.page.goto(`${BASE}/admin/tim`);
  await mob.page.waitForURL("**/admin");
  check("admin tim: /admin/tim dialihkan", true);
  await mob.page.goto(`${BASE}/admin/pengaturan`);
  await mob.page.waitForURL("**/admin");
  check("admin tim: /admin/pengaturan dialihkan", true);
  check("admin tim: menu Tim/Akun/Pengaturan tersembunyi", (await mob.page.locator("aside").getByRole("link", { name: "Tim" }).count()) === 0);

  // ---------- Admin tim Web: setujui ----------
  const web = await session();
  const w = web.page;
  await login(w, "admin.web@demo.local");
  await w.getByRole("heading", { name: "Ringkasan · Web Development" }).waitFor();
  check("admin tim Web: ringkasan sesuai tim", true);
  await w.screenshot({ path: `${shots}/admin-tim-ringkasan.png`, fullPage: true });
  await w.goto(`${BASE}/admin/pendaftaran`);
  const card = w.locator("section", { hasText: "Budi Tester" }).first();
  await card.getByText("MagangHub · lulus 2025").waitFor();
  await w.screenshot({ path: `${shots}/admin-tim-pendaftaran.png`, fullPage: true });
  await card.getByRole("button", { name: "Setujui" }).click();
  await card.waitFor({ state: "detached", timeout: 15000 });
  check("admin tim Web: menyetujui pendaftaran Budi", true);

  // ---------- Peserta absen ----------
  await p.goto(`${BASE}/absensi`);
  await p.getByText("dalam jangkauan", { exact: false }).first().waitFor({ timeout: 15000 });
  await takeSelfie(p);
  await p.getByRole("button", { name: "Absen masuk" }).click();
  await p.getByText("Absen masuk tercatat").waitFor();
  check("peserta: absen masuk", true);
  await p.goto(`${BASE}/aktivitas`);
  await p.fill("#f-title", "Membuat halaman login");
  await p.getByRole("button", { name: "Simpan aktivitas" }).click();
  await p.getByText("Aktivitas ditambahkan.").waitFor();
  check("peserta: aktivitas kerja", true);

  // ---------- Evaluasi oleh admin tim ----------
  await w.goto(`${BASE}/admin/evaluasi`);
  const row = w.locator("tr", { hasText: "Budi Tester" });
  await row.waitFor();
  check("evaluasi: Budi muncul di daftar bulan ini", (await w.locator("tr", { hasText: "Raka Pratama" }).count()) === 0);
  await w.screenshot({ path: `${shots}/admin-evaluasi.png`, fullPage: true });
  await row.getByRole("link", { name: "Nilai" }).click();
  await w.waitForURL("**/admin/evaluasi/**");
  await w.fill("#f-discipline", "150");
  for (const [k, v] of [["workQuality", "85"], ["communication", "80"], ["initiative", "75"], ["teamwork", "90"]]) await w.fill(`#f-${k}`, v);
  await w.fill("#f-notes", "Bagus, pertahankan konsistensi.");
  await w.getByRole("button", { name: "Simpan evaluasi" }).click();
  await w.locator("#f-discipline-err").waitFor();
  check("evaluasi: nilai >100 ditolak", true);
  await w.fill("#f-discipline", "90");
  await w.getByRole("button", { name: "Simpan evaluasi" }).click();
  await w.getByText("Evaluasi disimpan.").waitFor();
  check("evaluasi: tersimpan", true);
  await w.reload();
  await w.getByText("84").first().waitFor();
  check("evaluasi: rata-rata 84 tampil", true);
  await w.screenshot({ path: `${shots}/admin-evaluasi-form.png`, fullPage: true });

  await p.goto(`${BASE}/evaluasi`);
  await p.getByText("Bagus, pertahankan konsistensi.").waitFor();
  check("peserta: melihat evaluasi & catatan", true);
  await p.screenshot({ path: `${shots}/peserta-evaluasi.png`, fullPage: true });

  // ---------- Admin utama: tim & akun admin ----------
  const sup = await session();
  const s = sup.page;
  await login(s, "admin@magang.local", "Admin#12345");
  await s.goto(`${BASE}/admin/tim`);
  await s.fill("#new-f-name", "Web Development");
  await s.getByRole("button", { name: "Buat tim" }).click();
  await s.locator("#new-f-name-err").waitFor();
  check("tim: nama duplikat ditolak", true);
  await s.fill("#new-f-name", "QA Testing");
  await s.fill("#new-f-description", "Pengujian manual dan otomatis.");
  await s.getByRole("button", { name: "Buat tim" }).click();
  await s.getByText('Tim "QA Testing" dibuat.').waitFor();
  check("tim: dibuat", true);
  await guest.page.goto(BASE).catch(() => {});
  const g2 = (await session()).page;
  await g2.goto(BASE);
  await g2.getByText("QA Testing").waitFor();
  check("tim baru langsung tampil di landing", true);
  await s.goto(`${BASE}/admin/tim`);
  const qa = s.locator("section", { hasText: "QA Testing" }).first();
  await qa.getByRole("button", { name: "Tutup pendaftaran" }).click();
  await qa.getByRole("button", { name: "Buka pendaftaran" }).waitFor();
  await g2.goto(BASE);
  await g2.getByText("Tim yang membuka magang").waitFor();
  check("tim ditutup: hilang dari landing", (await g2.getByText("QA Testing").count()) === 0);
  await s.screenshot({ path: `${shots}/admin-tim.png`, fullPage: true });

  await s.goto(`${BASE}/admin/akun`);
  await s.fill("#f-name", "Admin QA");
  await s.fill("#f-email", "admin.qa@test.local");
  await s.fill("#f-password", "RahasiaQA1");
  await s.click("#f-role");
  await s.getByRole("option", { name: /Admin tim/ }).click();
  await s.getByRole("button", { name: "Buat akun" }).click();
  await s.locator("#f-teamId-err").waitFor();
  check("akun admin: admin tim tanpa tim ditolak", true);
  await s.fill("#f-teamId", "QA");
  await s.getByRole("option", { name: "QA Testing" }).click();
  await s.getByRole("button", { name: "Buat akun" }).click();
  await s.getByText("Akun admin admin.qa@test.local dibuat.").waitFor();
  check("akun admin: admin tim dibuat", true);
  await s.screenshot({ path: `${shots}/admin-akun.png`, fullPage: true });
  const qaAdmin = (await session()).page;
  await login(qaAdmin, "admin.qa@test.local", "RahasiaQA1");
  await qaAdmin.getByRole("heading", { name: "Ringkasan · QA Testing" }).waitFor();
  check("akun admin baru bisa login sebagai admin tim QA", true);

  // ---------- Pengaturan: peta ----------
  await s.goto(`${BASE}/admin/pengaturan`);
  await s.locator(".leaflet-tile-loaded").first().waitFor({ timeout: 20000 }).catch(() => {});
  await s.locator(".leaflet-container").waitFor();
  const before = await s.locator('input[name="latitude"]').inputValue();
  const box = await s.locator(".leaflet-container").boundingBox();
  await s.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.75);
  const after = await s.locator('input[name="latitude"]').inputValue();
  check("peta: klik memindahkan titik", before !== after, `${before} -> ${after}`);
  await s.locator("#f-radiusMeters").fill("400");
  const r = await s.locator('input[name="radiusMeters"]').inputValue();
  check("peta: slider mengubah radius", r === "400", r);
  await s.getByRole("button", { name: "Simpan pengaturan" }).click();
  await s.getByText("Pengaturan lokasi & jam kerja disimpan.").waitFor();
  await s.reload();
  await s.getByText("radius 400 m").waitFor();
  check("peta: titik & radius tersimpan", true);
  await s.waitForTimeout(1500);
  await s.screenshot({ path: `${shots}/pengaturan-v3.png`, fullPage: true });

  // titik pindah -> peserta kini di luar radius
  await budiCtx.setGeolocation(OFFICE);
  await p.goto(`${BASE}/absensi`);
  await p.getByText("Lihat titik kantor").waitFor();
  check("absensi peserta memakai titik baru", (await p.getByText("Radius absen 400 m").count()) > 0);

  // ---------- Ringkasan admin utama & mobile ----------
  await s.goto(`${BASE}/admin`);
  await s.getByText("Peserta aktif", { exact: true }).waitFor();
  await s.screenshot({ path: `${shots}/admin-utama.png`, fullPage: true });
  const m = await session({ width: 390, height: 844 });
  await login(m.page, "admin.web@demo.local");
  await m.page.getByText("Peserta aktif", { exact: true }).waitFor();
  await m.page.screenshot({ path: `${shots}/mobile-admin-tim.png` });
});
