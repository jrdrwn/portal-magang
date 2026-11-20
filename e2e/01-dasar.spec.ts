import { test, type Page } from "@playwright/test";
import { BASE, OFFICE, check, dateKey, plusDays, resetDemoAccounts, shotsDir, sql, takeSelfie, uploadDocs } from "./helpers";

test.describe.configure({ mode: "serial" });

test("Fitur dasar: daftar, pendaftaran, absensi, aktivitas, profil", async ({ browser }) => {
  await resetDemoAccounts();
  await sql(`DELETE FROM "User" WHERE email='budi@test.local'`);
  await sql(`DELETE FROM "Attendance" WHERE "userId" IN (SELECT id FROM "User" WHERE email='salsa@demo.local') AND date=(now() AT TIME ZONE 'Asia/Jakarta')::date`);
  await sql(`UPDATE "OfficeSetting" SET latitude=-6.2088, longitude=106.8456, "radiusMeters"=150 WHERE id=1`);
  const shots = shotsDir("dasar");
  const key = (d = new Date()) => dateKey(d);
  const plus = (n: number) => plusDays(n);



async function newUser(geo: { latitude: number; longitude: number } = OFFICE) {
  const ctx = await browser.newContext({
    viewport: { width: 1360, height: 900 },
    permissions: ["geolocation", "camera"],
    geolocation: geo,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return { ctx, page };
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill("#f-email", email);
  await page.fill("#f-password", password);
  await page.click('button[type="submit"]');
}

  // ---------- Intern: daftar akun + pendaftaran ----------
  const budi = await newUser();
  const p = budi.page;
  await p.goto(`${BASE}/daftar`);
  await p.screenshot({ path: `${shots}/daftar.png` });
  await p.click('button[type="submit"]');
  await p.locator("#f-name-err").waitFor({ timeout: 10000 }).catch(() => {});
  check("daftar: validasi kosong menampilkan error", (await p.locator("#f-name-err").count()) > 0);

  await p.fill("#f-name", "Budi Tester");
  await p.fill("#f-email", "budi@test.local");
  await p.fill("#f-password", "Rahasia123");
  await p.fill("#f-confirm", "Rahasia123");
  await p.click('button[type="submit"]');
  await p.waitForURL("**/pendaftaran");
  check("daftar: akun dibuat & redirect ke /pendaftaran", true);

  await p.goto(`${BASE}/admin`);
  await p.waitForURL("**/dashboard");
  check("intern tidak bisa masuk /admin", p.url().endsWith("/dashboard"));

  await p.goto(`${BASE}/absensi`);
  await p.getByText("belum memiliki periode magang aktif").first().waitFor({ timeout: 10000 });
  check("absensi diblokir tanpa pendaftaran aktif", true);

  await p.goto(`${BASE}/pendaftaran`);
  await p.getByRole("radio", { name: /Web Development/ }).check();
  await p.fill("#f-startDate", plus(-1));
  await p.fill("#f-endDate", plus(30));
  await p.fill("#f-motivation", "Ingin belajar membangun aplikasi web.");
  await uploadDocs(p);
  await p.click('main button[type="submit"]');
  await p.locator("#f-startDate-err").waitFor({ timeout: 10000 });
  check("pendaftaran: tanggal mulai di masa lalu ditolak", true);
  await p.fill("#f-startDate", key());
  await p.click('main button[type="submit"]');
  await p.getByText("Pendaftaran terkirim").waitFor();
  check("pendaftaran: terkirim", true);
  await p.screenshot({ path: `${shots}/pendaftaran.png`, fullPage: true });

  // ---------- Admin: setujui ----------
  const admin = await newUser();
  const a = admin.page;
  await login(a, "admin@magang.local", "Admin#12345");
  await a.waitForURL("**/admin");
  check("admin login -> /admin", true);
  await a.getByText("Peserta aktif", { exact: true }).waitFor();
  await a.screenshot({ path: `${shots}/admin-home.png`, fullPage: true });

  await a.goto(`${BASE}/admin/pendaftaran`);
  const card = a.locator("section", { hasText: "Budi Tester" }).first();
  await card.getByRole("button", { name: "Tolak" }).click();
  await card.getByText("Isi alasan penolakan").waitFor();
  check("admin: tolak tanpa alasan ditolak validasi", true);
  await a.screenshot({ path: `${shots}/admin-pendaftaran.png`, fullPage: true });
  await card.getByRole("button", { name: "Setujui" }).click();
  await a.locator("section", { hasText: "Budi Tester" }).first().waitFor({ state: "detached", timeout: 15000 });
  await a.goto(`${BASE}/admin/pendaftaran?status=APPROVED`);
  await a.locator("section", { hasText: "Budi Tester" }).getByText("Disetujui").first().waitFor();
  check("admin: pendaftaran disetujui & pindah ke tab Disetujui", true);

  // ---------- Intern: absen ----------
  await p.goto(`${BASE}/absensi`);
  await p.getByText("dalam jangkauan", { exact: false }).first().waitFor({ timeout: 15000 });
  check("absensi: lokasi dalam jangkauan terdeteksi", true);
  check("absensi: tombol nonaktif sebelum swafoto", await p.getByRole("button", { name: "Absen masuk" }).isDisabled());
  await takeSelfie(p);
  await p.screenshot({ path: `${shots}/absensi.png`, fullPage: true });

  // Di luar radius -> tombol nonaktif
  await budi.ctx.setGeolocation({ latitude: -6.3, longitude: 106.9 });
  await p.getByText("di luar jangkauan", { exact: false }).first().waitFor({ timeout: 15000 });
  const disabled = await p.getByRole("button", { name: "Absen masuk" }).isDisabled();
  check("absensi: tombol nonaktif di luar radius", disabled);
  await budi.ctx.setGeolocation(OFFICE);
  await p.getByText("dalam jangkauan", { exact: false }).first().waitFor({ timeout: 15000 });
  await p.getByRole("button", { name: "Absen masuk" }).click();
  await p.getByText("Absen masuk tercatat").waitFor();
  check("absensi: absen masuk berhasil", true);
  await p.getByRole("button", { name: "Absen pulang" }).waitFor();
  check("absensi: tombol berubah ke Absen pulang", true);

  // ---------- Intern: aktivitas ----------
  await p.goto(`${BASE}/aktivitas`);
  await p.getByText("Bekerja", { exact: false }).first().waitFor();
  await p.fill("#f-title", "Membuat halaman login");
  await p.fill("#f-description", "Form + validasi");
  await p.getByRole("button", { name: "Simpan aktivitas" }).click();
  await p.getByText("Aktivitas ditambahkan.").waitFor();
  await p.getByText("Membuat halaman login").first().waitFor();
  check("aktivitas: kerja tercatat setelah absen", true);
  await p.screenshot({ path: `${shots}/aktivitas.png`, fullPage: true });

  // checkout
  await p.goto(`${BASE}/absensi`);
  await p.getByText("dalam jangkauan", { exact: false }).first().waitFor({ timeout: 15000 });
  await takeSelfie(p);
  await p.getByRole("button", { name: "Absen pulang" }).click();
  await p.getByText("Absen pulang tercatat").waitFor();
  check("absensi: absen pulang berhasil", true);

  await p.goto(`${BASE}/dashboard`);
  await p.getByText("Status hari ini").waitFor();
  await p.screenshot({ path: `${shots}/dashboard.png`, fullPage: true });

  // ---------- Intern demo: izin (tidak bekerja) ----------
  const salsa = await newUser();
  const s = salsa.page;
  await login(s, "salsa@demo.local", "Demo#12345");
  await s.waitForURL("**/dashboard");
  await s.goto(`${BASE}/aktivitas`);
  check(
    "aktivitas: belum absen -> form kerja tidak tersedia",
    (await s.locator("#f-title").count()) === 0,
  );
  await s.goto(`${BASE}/absensi`);
  await s.fill("#f-note", "ke");
  await s.getByRole("button", { name: "Kirim laporan" }).click();
  await s.locator("#f-note-err").waitFor();
  check("izin: alasan terlalu pendek ditolak", true);
  await s.fill("#f-note", "Ada keperluan keluarga mendadak");
  await s.getByRole("button", { name: "Kirim laporan" }).click();
  await s.getByText("Hari ini Anda tercatat izin").waitFor();
  check("izin: tercatat", true);
  await s.goto(`${BASE}/aktivitas`);
  await s.getByText("Tidak bekerja", { exact: false }).first().waitFor();
  check("aktivitas: status Tidak bekerja", (await s.locator("#f-title").count()) === 0);

  // ---------- Profil ----------
  await p.goto(`${BASE}/profil`);
  await p.fill("#f-institution", "Universitas Test");
  await p.fill("#f-phone", "081234567890");
  await p.getByRole("button", { name: "Simpan perubahan" }).click();
  await p.getByText("Profil diperbarui.").waitFor();
  check("profil: tersimpan", true);
  await p.fill("#f-phone", "abc");
  await p.getByRole("button", { name: "Simpan perubahan" }).click();
  await p.locator("#f-phone-err").waitFor();
  check("profil: validasi telepon", true);
  await p.screenshot({ path: `${shots}/profil.png`, fullPage: true });

  // ---------- Admin: monitor ----------
  await a.goto(`${BASE}/admin/absensi`);
  await a.getByText("Budi Tester").first().waitFor();
  check("admin: absensi menampilkan Budi", true);
  await a.screenshot({ path: `${shots}/admin-absensi.png`, fullPage: true });
  await a.goto(`${BASE}/admin/aktivitas`);
  await a.getByText("Membuat halaman login").waitFor();
  check("admin: aktivitas menampilkan kerja Budi", true);
  await a.screenshot({ path: `${shots}/admin-aktivitas.png`, fullPage: true });
  await a.goto(`${BASE}/admin/aktivitas?type=NOT_WORK`);
  await a.getByText("Salsa Amelia").waitFor();
  check("admin: filter tidak bekerja menampilkan Salsa", true);
  await a.goto(`${BASE}/admin/peserta`);
  await a.screenshot({ path: `${shots}/admin-peserta.png`, fullPage: true });
  await a.getByRole("link", { name: /Budi Tester/ }).click();
  await a.waitForURL("**/admin/peserta/*");
  await a.getByText("Riwayat absensi").waitFor();
  check("admin: detail peserta", true);
  await a.screenshot({ path: `${shots}/admin-detail.png`, fullPage: true });

  // ---------- Mobile ----------
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["geolocation", "camera"], geolocation: OFFICE });
  const m = await mob.newPage();
  await login(m, "nadia@demo.local", "Demo#12345");
  await m.waitForURL("**/dashboard");
  await m.getByText("Status hari ini").waitFor();
  await m.screenshot({ path: `${shots}/mobile-dashboard.png` });
  await m.goto(`${BASE}/absensi`);
  await m.getByText("dalam jangkauan", { exact: false }).first().waitFor({ timeout: 15000 }).catch(() => {});
  await m.screenshot({ path: `${shots}/mobile-absensi.png` });

  // ---------- Logout & proteksi ----------
  await p.goto(`${BASE}/dashboard`);
  await p.locator("aside").getByRole("button", { name: "Keluar" }).click();
  await p.waitForURL("**/login");
  await p.goto(`${BASE}/dashboard`);
  await p.waitForURL("**/login");
  check("logout: halaman terproteksi kembali ke /login", true);

  const bad = await newUser();
  await login(bad.page, "budi@test.local", "salah-salah");
  await bad.page.getByText("Email atau password salah.").waitFor();
  check("login: password salah ditolak", true);

  const landing = await newUser();
  await landing.page.goto(BASE);
  await landing.page.screenshot({ path: `${shots}/landing.png`, fullPage: true });
  await landing.page.goto(`${BASE}/login`);
  await landing.page.screenshot({ path: `${shots}/login.png` });
});
