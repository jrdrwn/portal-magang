import { test, type Page } from "@playwright/test";
import { BASE, check, resetDemoAccounts, shotsDir, sql, uploadDocs } from "./helpers";

test.describe.configure({ mode: "serial" });

test("Combobox, notifikasi, sticky, survei & sertifikat", async ({ browser }) => {
  await resetDemoAccounts();
  await sql(`DELETE FROM "User" WHERE email='eka@test.local'`);
  await sql(`DELETE FROM "Notification"`);
  await sql(`DELETE FROM "Certificate" WHERE "registrationId" IN (SELECT r.id FROM "Registration" r JOIN "User" u ON u.id=r."userId" WHERE u.email='dimas@demo.local')`);
  await sql(`DELETE FROM "SurveyResponse" WHERE "userId" IN (SELECT id FROM "User" WHERE email='dimas@demo.local')`);
  await sql(`DELETE FROM "Attendance" WHERE "userId" IN (SELECT id FROM "User" WHERE email='salsa@demo.local') AND date=CURRENT_DATE`);
  await sql(`UPDATE "OfficeSetting" SET latitude=-6.2088, longitude=106.8456, "radiusMeters"=150, "signerName"='' WHERE id=1`);
  const shots = shotsDir("sertifikat");


async function session(viewport: { width: number; height: number } = { width: 1360, height: 900 }) {
  const ctx = await browser.newContext({ viewport, permissions: ["geolocation", "camera"], geolocation: { latitude: -6.2088, longitude: 106.8456 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return { ctx, page };
}
async function login(page: Page, email: string, password = "Demo#12345") {
  await page.goto(`${BASE}/login`);
  await page.fill("#f-email", email);
  await page.fill("#f-password", password);
  await page.click('form button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}
const bellCount = async (page: Page) => {
  const label = await page.locator("aside").getByRole("button", { name: /^Notifikasi/ }).getAttribute("aria-label");
  return Number(label.match(/(\d+) belum/)?.[1] ?? 0);
};
async function waitBell(page: Page, min: number) {
  for (let i = 0; i < 20; i++) {
    await page.reload();
    await page.waitForTimeout(600);
    if ((await bellCount(page)) >= min) return true;
  }
  return false;
}

  // ---------- Combobox: mouse & keyboard ----------
  const sup = await session();
  const s = sup.page;
  await login(s, "admin@magang.local", "Admin#12345");
  await s.goto(`${BASE}/admin/akun`);
  await s.waitForLoadState("networkidle");
  const role = s.locator("#f-role");
  check("combobox: role=combobox & tampil label", (await role.getAttribute("role")) === "combobox" && (await role.textContent()).includes("Admin tim"));
  await role.focus();
  await s.keyboard.press("ArrowDown");
  await s.getByRole("listbox").first().waitFor();
  check("combobox keyboard: ArrowDown membuka listbox", (await role.getAttribute("aria-expanded")) === "true");
  await s.keyboard.press("ArrowDown");
  await s.keyboard.press("Enter");
  const roleVal = await s.locator('input[type="hidden"][name="role"]').inputValue();
  check("combobox keyboard: Enter memilih opsi", roleVal === "SUPER_ADMIN", roleVal);
  await s.keyboard.press("ArrowDown");
  await s.keyboard.press("Escape");
  check("combobox keyboard: Escape menutup", (await role.getAttribute("aria-expanded")) === "false");
  await s.fill("#f-teamId", "mob");
  const opts = await s.getByRole("option").allTextContents();
  check("autocomplete tim: menyaring hasil ketikan", opts.length === 1 && opts[0].includes("Mobile Development"), opts.join(","));
  await s.getByRole("option", { name: "Mobile Development" }).click();
  check("autocomplete tim: pilihan masuk ke input form", (await s.locator('input[type="hidden"][name="teamId"]').first().inputValue()).length > 0);
  await s.screenshot({ path: `${shots}/akun-combobox.png` });

  // ---------- Autocomplete pencarian peserta ----------
  await s.goto(`${BASE}/admin/peserta`);
  await s.waitForLoadState("networkidle");
  const q = s.getByRole("combobox", { name: "Cari peserta" });
  await q.fill("nad");
  await s.getByRole("option", { name: /Nadia Putri/ }).waitFor();
  check("autocomplete peserta: saran nama muncul", true);
  await s.screenshot({ path: `${shots}/peserta-autocomplete.png` });
  await s.getByRole("option", { name: /Nadia Putri/ }).click();
  await s.getByRole("button", { name: "Cari" }).click();
  await s.waitForURL(/q=Nadia/);
  check("autocomplete peserta: hasil pencarian tersaring", (await s.locator("tbody tr").count()) === 1);
  await s.goto(`${BASE}/admin/peserta`);
  await s.waitForLoadState("networkidle");
  await s.getByRole("combobox", { name: "Filter jenis magang" }).click();
  await s.getByRole("option", { name: "MagangHub" }).click();
  await s.getByRole("button", { name: "Cari" }).click();
  await s.waitForURL(/type=MAGANGHUB/);
  const rows = await s.locator("tbody").innerText();
  check("combobox filter jenis: hanya MagangHub", rows.includes("Raka") && !rows.includes("Nadia"));

  // ---------- Peserta baru -> notifikasi admin ----------
  const eka = await session();
  const e = eka.page;
  await e.goto(`${BASE}/daftar`);
  await e.fill("#f-name", "Eka Lestari");
  await e.fill("#f-email", "eka@test.local");
  await e.fill("#f-password", "Rahasia123");
  await e.fill("#f-confirm", "Rahasia123");
  await e.click('form button[type="submit"]');
  await e.waitForURL("**/pendaftaran");
  await e.getByRole("radio", { name: /Web Development/ }).check();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const later = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + 40 * 864e5));
  await e.fill("#f-startDate", today);
  await e.fill("#f-endDate", later);
  await e.fill("#f-motivation", "Ingin belajar pengembangan web modern.");
  await uploadDocs(e);
  await e.click('main button[type="submit"]');
  await e.getByText("Pendaftaran terkirim").waitFor();

  const web = await session();
  const w = web.page;
  await login(w, "admin.web@demo.local");
  check("notifikasi: admin tim dapat badge pendaftaran baru", await waitBell(w, 1), String(await bellCount(w)));
  await w.locator("aside").getByRole("button", { name: /^Notifikasi/ }).click();
  await w.getByRole("dialog", { name: "Notifikasi" }).getByText("Pendaftaran baru").waitFor();
  check("notifikasi: isi popover benar", (await w.getByRole("dialog", { name: "Notifikasi" }).innerText()).includes("Eka Lestari mendaftar ke tim Web Development"));
  await w.screenshot({ path: `${shots}/bell-admin.png` });
  const mob = (await session()).page;
  await login(mob, "admin.mobile@demo.local");
  await mob.waitForTimeout(1500);
  check("notifikasi: admin tim lain tidak menerima", (await bellCount(mob)) === 0);

  await w.getByRole("dialog", { name: "Notifikasi" }).getByRole("button", { name: /Pendaftaran baru/ }).click();
  await w.waitForURL("**/admin/pendaftaran");
  check("notifikasi: klik membuka tautan & tandai dibaca", (await bellCount(w)) === 0);
  const card = w.locator("section:visible", { hasText: "Eka Lestari" }).first();
  await card.getByRole("button", { name: "Setujui" }).click();
  await w.getByText("Pendaftaran disetujui.").or(w.getByText("Tidak ada pendaftaran")).first().waitFor({ timeout: 15000 });

  check("notifikasi: peserta dapat kabar disetujui", await waitBell(e, 1));
  await e.locator("aside").getByRole("button", { name: /^Notifikasi/ }).click();
  await e.getByRole("dialog", { name: "Notifikasi" }).getByText("Pendaftaran disetujui").waitFor();
  await e.screenshot({ path: `${shots}/bell-peserta.png` });
  await e.getByRole("dialog", { name: "Notifikasi" }).getByRole("link", { name: "Lihat semua" }).click();
  await e.waitForURL("**/notifikasi");
  await e.getByRole("heading", { name: "Notifikasi" }).waitFor();
  check("halaman semua notifikasi", (await e.locator("main").innerText()).includes("Selamat! Anda diterima di tim Web Development"));

  // ---------- Absensi tanpa judul + izin -> notifikasi admin ----------
  const salsa = (await session()).page;
  await login(salsa, "salsa@demo.local");
  await salsa.goto(`${BASE}/absensi`);
  await salsa.waitForLoadState("networkidle");
  await salsa.getByText("Riwayat absensi").waitFor();
  check("absensi: tanpa judul halaman", (await salsa.locator("main h1").count()) === 0);
  await salsa.click("#f-kind");
  await salsa.getByRole("option", { name: /Sakit/ }).click();
  await salsa.fill("#f-note", "Demam sejak semalam");
  await salsa.getByRole("button", { name: "Kirim laporan" }).click();
  await salsa.getByText("Hari ini Anda tercatat sakit").waitFor();
  check("absensi: combobox jenis (Sakit) tersimpan", true);
  const uiux = (await session()).page;
  await login(uiux, "admin.uiux@demo.local");
  check("notifikasi: laporan sakit sampai ke admin tim UI/UX", await waitBell(uiux, 1));

  // ---------- Profil: autocomplete kampus ----------
  const nadia = (await session()).page;
  await login(nadia, "nadia@demo.local");
  await nadia.goto(`${BASE}/profil`);
  await nadia.waitForLoadState("networkidle");
  await nadia.fill("#f-institution", "");
  await nadia.locator("#f-institution").pressSequentially("gadjah");
  await nadia.getByRole("option", { name: "Universitas Gadjah Mada" }).waitFor();
  check("profil: autocomplete kampus dari data yang ada", true);
  await nadia.screenshot({ path: `${shots}/profil-autocomplete.png` });
  await nadia.keyboard.press("Escape");
  await nadia.fill("#f-institution", "Universitas Indonesia");
  await nadia.getByRole("button", { name: "Simpan perubahan" }).click();
  await nadia.getByText("Profil diperbarui.").waitFor();
  check("profil: teks bebas tetap bisa disimpan", true);

  // ---------- Sticky ----------
  const pos = await nadia.evaluate(() => {
    const card = [...document.querySelectorAll("main section")].find((el) => getComputedStyle(el.parentElement).position === "sticky");
    return card ? getComputedStyle(card.parentElement).position : null;
  });
  check("sticky: kolom kiri profil sticky di layar lebar", pos === "sticky");
  await s.goto(`${BASE}/admin/tim`);
  await s.waitForLoadState("networkidle");
  const stickyCard = s.locator("section", { hasText: "Buat tim baru" });
  check("sticky: form Buat tim sticky", (await stickyCard.evaluate((el) => getComputedStyle(el).position)) === "sticky");
  const m = await session({ width: 390, height: 844 });
  await login(m.page, "nadia@demo.local");
  await m.page.mouse.wheel(0, 900);
  await m.page.waitForTimeout(400);
  const hdr = await m.page.locator("header").first().boundingBox();
  check("sticky: header mobile tetap di atas saat scroll", hdr && hdr.y >= 0 && hdr.y < 20, JSON.stringify(hdr));
  await m.page.screenshot({ path: `${shots}/mobile-scroll.png` });

  // ---------- Survei & sertifikat ----------
  await s.goto(`${BASE}/admin/pengaturan`);
  await s.waitForLoadState("networkidle");
  await s.fill("#cert-f-signerName", "Dr. Rina Kartika");
  await s.getByRole("button", { name: "Simpan", exact: true }).click();
  await s.getByText("Pengaturan sertifikat disimpan.").waitFor();
  check("pengaturan sertifikat tersimpan", true);

  const dimas = (await session()).page;
  await login(dimas, "dimas@demo.local");
  await dimas.getByText("magang Anda di tim Web Development sudah selesai").waitFor();
  check("dashboard: banner survei untuk periode selesai", true);
  check("notifikasi: pengingat survei otomatis", await waitBell(dimas, 1));
  await dimas.goto(`${BASE}/sertifikat`);
  await dimas.getByRole("link", { name: "Isi survei akhir" }).click();
  await dimas.waitForURL("**/sertifikat/survei/*");
  const surveyUrl = dimas.url();
  await dimas.getByRole("button", { name: /Kirim survei/ }).click();
  await dimas.locator("#f-overall-err").waitFor();
  check("survei: nilai wajib diisi", (await dimas.locator("#f-highlights-err").count()) === 1);
  for (const k of ["overall", "relevance", "mentoring", "environment", "recommend"]) {
    await dimas.locator(`input[name="${k}"][value="5"]`).check({ force: true });
  }
  await dimas.fill("#f-highlights", "Belajar membangun fitur dari desain sampai rilis.");
  await dimas.screenshot({ path: `${shots}/survei.png`, fullPage: true });
  await dimas.getByRole("button", { name: /Kirim survei/ }).click();
  await dimas.waitForURL("**/sertifikat");
  await dimas.getByText("Terbit", { exact: true }).waitFor();
  check("survei terkirim -> sertifikat terbit", true);
  await dimas.goto(surveyUrl);
  await dimas.waitForURL("**/sertifikat");
  check("survei tidak bisa diisi dua kali", true);
  const code = (await dimas.locator("span.font-mono").first().textContent()).trim();
  await dimas.getByRole("link", { name: /Lihat & unduh/ }).click();
  await dimas.waitForURL("**/cetak/sertifikat/*");
  const certUrl = dimas.url();
  const sheet = dimas.getByRole("article", { name: /Sertifikat Dimas Saputra/ });
  await sheet.waitFor();
  const text = await sheet.innerText();
  check("sertifikat: nama, tim, predikat, penandatangan", text.includes("Dimas Saputra") && text.includes("Web Development") && text.includes("Sangat baik") && text.includes("Dr. Rina Kartika"));
  check("sertifikat: QR tersedia", (await sheet.locator("svg path").count()) > 0);
  check("sertifikat: tombol cetak tersedia", await dimas.getByRole("button", { name: /Cetak/ }).isVisible());
  await dimas.screenshot({ path: `${shots}/sertifikat.png`, fullPage: true });
  await dimas.emulateMedia({ media: "print" });
  check("sertifikat (print): toolbar disembunyikan", !(await dimas.getByRole("button", { name: /Cetak/ }).isVisible()));
  await dimas.pdf?.({ path: `${shots}/sertifikat.pdf` }).catch(() => {});
  await dimas.emulateMedia({ media: "screen" });

  const pub = (await session()).page;
  await pub.goto(`${BASE}/verifikasi/${code}`);
  await pub.getByText("Sertifikat asli").waitFor();
  check("verifikasi publik: kode valid", (await pub.locator("main").innerText()).includes("Dimas Saputra"));
  await pub.screenshot({ path: `${shots}/verifikasi.png` });
  await pub.goto(`${BASE}/verifikasi/ABCDEFGHJK`);
  await pub.getByText("Sertifikat tidak ditemukan").waitFor();
  check("verifikasi publik: kode palsu ditolak", true);

  const denied = async (pg: Page) => {
    await pg.goto(certUrl);
    await pg.getByText("Halaman tidak ditemukan").waitFor({ timeout: 15000 });
    const html = await pg.content();
    return !html.includes("Dimas Saputra") && (await pg.getByRole("article").count()) === 0;
  };
  check("akses: peserta lain tidak bisa membuka sertifikat (isi tidak terkirim)", await denied(nadia));
  check("akses: admin tim lain tidak bisa membuka (isi tidak terkirim)", await denied(mob));
  await w.goto(certUrl);
  await w.getByRole("article", { name: /Sertifikat Dimas/ }).waitFor();
  check("akses: admin tim terkait bisa membuka", true);
  await dimas.goto(`${BASE}/notifikasi`);
  await dimas.getByText("Sertifikat magang terbit").waitFor();
  check("notifikasi: sertifikat terbit", true);

  await w.goto(`${BASE}/admin/survei`);
  await w.getByText("Belajar membangun fitur dari desain sampai rilis.").waitFor();
  check("admin: hasil survei tampil", (await w.locator("main").innerText()).includes("Responden"));
  await w.screenshot({ path: `${shots}/admin-survei.png`, fullPage: true });
  await mob.goto(`${BASE}/admin/survei`);
  await mob.getByText("Belum ada survei").waitFor();
  check("admin tim lain: survei tim lain tidak tampil", true);
});
