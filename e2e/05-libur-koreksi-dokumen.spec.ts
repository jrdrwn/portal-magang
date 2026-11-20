import { test, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import {
  BASE,
  PDF,
  PNG,
  check,
  dateKey,
  loggedIn,
  login,
  newSession,
  plusDays,
  resetDemoAccounts,
  shotsDir,
  sql,
  takeSelfie,
  uploadDocs,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test("Hari libur & alpa, koreksi absensi, kuota & jadwal, dokumen, swafoto, laporan, log admin", async ({ browser }) => {
  await resetDemoAccounts();
  await sql(`DELETE FROM "User" WHERE email IN ('fajar@test.local','gita@test.local')`);
  // Peserta aktif tanpa absen hari ini (untuk uji hari libur).
  await sql(
    `WITH u AS (
       INSERT INTO "User" (id, email, name, "passwordHash", role, "isActive", "updatedAt")
       VALUES ('e2e_gita', 'gita@test.local', 'Gita Permata', $1, 'INTERN', true, now()) RETURNING id
     )
     INSERT INTO "Registration" (id, "userId", "teamId", type, "startDate", "endDate", motivation, status, "reviewedAt")
     SELECT 'e2e_gita_reg', u.id, t.id, 'MANDIRI', $2::date, $3::date, 'Data uji', 'APPROVED', now()
     FROM u, "Team" t WHERE t.name = 'Web Development'`,
    [bcrypt.hashSync("Rahasia123", 10), plusDays(-5), plusDays(30)],
  );
  await sql(`UPDATE "Team" SET quota=NULL, "regOpensAt"=NULL, "regClosesAt"=NULL, "isOpen"=true WHERE name <> 'Data Analyst'`);
  await sql(`UPDATE "OfficeSetting" SET "requireSelfie"=true, latitude=-6.2088, longitude=106.8456, "radiusMeters"=150 WHERE id=1`);
  const shots = shotsDir("fitur-lanjutan");
  const today = dateKey();
  const idOf = async (email: string) => (await sql(`SELECT id FROM "User" WHERE email=$1`, [email]))[0].id as string;
  const nadiaId = await idOf("nadia@demo.local");
  const status = async (page: Page, url: string) => (await page.request.get(url)).status();
  const alpaCount = async (page: Page) =>
    Number((await page.locator("main").innerText()).match(/Alpa\s*\n\s*(\d+)\s*\n\s*hari kerja tanpa catatan/)?.[1]);
  // Halaman (bukan route API) yang ditolak menampilkan 404 kustom; status HTTP bisa 200 karena streaming.
  const pageDenied = async (page: Page, url: string) => {
    await page.goto(url);
    await page.getByText("Halaman tidak ditemukan").waitFor();
    return (await page.locator("form").count()) === 0 && (await page.getByRole("article").count()) === 0;
  };

  const sup = (await newSession(browser)).page;
  await login(sup, "admin@magang.local", "Admin#12345");
  await loggedIn(sup);
  const web = (await newSession(browser)).page;
  await login(web, "admin.web@demo.local");
  await loggedIn(web);
  const mob = (await newSession(browser)).page;
  await login(mob, "admin.mobile@demo.local");
  await loggedIn(mob);
  const nadia = (await newSession(browser)).page;
  await login(nadia, "nadia@demo.local");
  await loggedIn(nadia);

  await test.step("hari libur 2026 tersedia & bisa dikelola", async () => {
    await sup.goto(`${BASE}/admin/libur?year=2026`);
    await sup.getByText("Tahun Baru Masehi").waitFor();
    check("libur: 25 hari libur 2026 dari SKB", (await sup.getByText("25 hari").count()) === 1);
    check("libur: cuti bersama Idul Fitri ada", (await sup.getByText("Cuti bersama Idul Fitri 1447 H").count()) === 3);
    await sup.screenshot({ path: `${shots}/libur.png`, fullPage: true });

    await sup.fill("#h-f-date", today);
    await sup.fill("#h-f-name", "HUT kantor (uji)");
    await sup.getByRole("button", { name: "Tambah" }).click();
    await sup.getByText(/Libur .* ditambahkan/).waitFor();
    await sup.fill("#h-f-date", today);
    await sup.fill("#h-f-name", "Duplikat");
    await sup.getByRole("button", { name: "Tambah" }).click();
    await sup.locator("#h-f-date-err").waitFor();
    check("libur: tanggal ganda ditolak", true);

    const eka = (await newSession(browser)).page;
    await login(eka, "gita@test.local", "Rahasia123");
    await loggedIn(eka);
    await eka.goto(`${BASE}/absensi`);
    await eka.locator("main").getByText("Hari ini libur: HUT kantor (uji).").waitFor();
    check("absensi diblokir di hari libur", (await eka.getByRole("button", { name: "Absen masuk" }).count()) === 0);
    check("form izin/sakit disembunyikan di hari libur", (await eka.locator("#f-note").count()) === 0);
    await web.goto(`${BASE}/admin`);
    await web.getByText("Hari ini tidak ada absen").waitFor();
    check("ringkasan admin: tidak ada 'belum absen' di hari libur", true);

    await sup.goto(`${BASE}/admin/libur?year=${today.slice(0, 4)}`);
    sup.once("dialog", (d) => d.accept());
    await sup.locator("tr", { hasText: "HUT kantor (uji)" }).getByRole("button", { name: "Hapus" }).click();
    await sup.locator("tr", { hasText: "HUT kantor (uji)" }).waitFor({ state: "detached" });
    await eka.goto(`${BASE}/absensi`);
    await eka.getByText("Riwayat absensi").waitFor();
    check("libur dihapus: absensi tidak diblokir lagi", (await eka.getByText("Hari ini libur").count()) === 0 && (await eka.locator("#f-note").count()) === 1);
  });

  let alpaBefore = 0;
  await test.step("alpa dihitung dari hari kerja tanpa catatan", async () => {
    await web.goto(`${BASE}/admin/peserta/${nadiaId}`);
    await web.getByText("hari kerja tanpa catatan").waitFor();
    alpaBefore = await alpaCount(web);
    check("detail peserta: jumlah alpa > 0", alpaBefore > 0, String(alpaBefore));
    check("tabel harian menampilkan baris Alpa", (await web.locator("tbody").getByText("Alpa", { exact: true }).count()) > 0);
    const from = plusDays(-30);
    const csv = await (await web.request.get(`${BASE}/admin/export/absensi?from=${from}&to=${today}`)).text();
    check("export CSV memuat Alpa dan kolom Dikoreksi", csv.includes(";Alpa;") && csv.split("\n")[0].includes("Dikoreksi"));
  });

  await test.step("koreksi absensi oleh admin tim", async () => {
    const alpaRow = web.locator("tbody tr", { has: web.getByText("Alpa", { exact: true }) }).first();
    await alpaRow.getByRole("link", { name: "Koreksi" }).click();
    await web.waitForURL(/\/koreksi\/\d{4}-\d{2}-\d{2}$/);
    const date = web.url().split("/").pop()!;
    await web.waitForLoadState("networkidle");
    await web.getByRole("button", { name: "Simpan koreksi" }).click();
    await web.locator("#f-checkIn-err").waitFor();
    check("koreksi: jam masuk & alasan wajib", (await web.locator("#f-reason-err").count()) === 1);
    await web.fill("#f-checkIn", "08:05");
    await web.fill("#f-checkOut", "07:00");
    await web.fill("#f-reason", "Lupa absen, dikonfirmasi mentor");
    await web.getByRole("button", { name: "Simpan koreksi" }).click();
    await web.locator("#f-checkOut-err").waitFor();
    check("koreksi: jam pulang harus setelah jam masuk", true);
    await web.fill("#f-checkOut", "16:00");
    await web.screenshot({ path: `${shots}/koreksi.png`, fullPage: true });
    await web.getByRole("button", { name: "Simpan koreksi" }).click();
    await web.waitForURL(new RegExp(`koreksi=${date}`));
    await web.getByText(/Koreksi absensi .* tersimpan/).waitFor();
    check("koreksi tersimpan & badge Dikoreksi", (await web.locator("tbody").getByText("Dikoreksi").count()) > 0);
    const after = await alpaCount(web);
    check("koreksi: alpa berkurang satu", after === alpaBefore - 1, `${alpaBefore} -> ${after}`);
    const rec = await sql(`SELECT status, "correctionReason" FROM "Attendance" WHERE "userId"=$1 AND date=$2`, [nadiaId, date]);
    check("koreksi: data tersimpan di DB", rec[0]?.status === "PRESENT" && rec[0]?.correctionReason.includes("mentor"));

    check("koreksi: admin tim lain tidak bisa membuka", await pageDenied(mob, `${BASE}/admin/peserta/${nadiaId}/koreksi/${date}`));

    // Hari dengan aktivitas kerja tidak boleh dijadikan alpa.
    const worked = await sql(
      `SELECT a.date::text AS d FROM "Attendance" a JOIN "Activity" x ON x."attendanceId"=a.id AND x.type='WORK' WHERE a."userId"=$1 ORDER BY a.date DESC LIMIT 1`,
      [nadiaId],
    );
    await web.goto(`${BASE}/admin/peserta/${nadiaId}/koreksi/${worked[0].d}`);
    await web.waitForLoadState("networkidle");
    await web.click("#f-status");
    await web.getByRole("option", { name: /Alpa/ }).click();
    await web.fill("#f-reason", "Uji pengaman data");
    await web.getByRole("button", { name: "Simpan koreksi" }).click();
    await web.getByText("tidak bisa diubah menjadi alpa").waitFor();
    check("koreksi: hari dengan aktivitas kerja tidak bisa dijadikan alpa", true);

    await nadia.goto(`${BASE}/notifikasi`);
    await nadia.getByText(/Absensi .* dikoreksi/).first().waitFor();
    check("peserta mendapat notifikasi koreksi", true);
  });

  await test.step("kuota & jadwal pendaftaran", async () => {
    await sup.goto(`${BASE}/admin/tim`);
    await sup.waitForLoadState("networkidle");
    const mobile = sup.locator("section", { hasText: "Aplikasi Android/iOS" }).first();
    await mobile.getByText("Edit tim").click();
    await mobile.locator('input[name="regOpensAt"]').fill(plusDays(-10));
    await mobile.locator('input[name="regClosesAt"]').fill(plusDays(-20));
    await mobile.getByRole("button", { name: "Simpan" }).click();
    await mobile.getByText("Tanggal tutup tidak boleh sebelum tanggal buka").waitFor();
    check("jadwal: tutup sebelum buka ditolak", true);
    await mobile.locator('input[name="regClosesAt"]').fill(plusDays(-1));
    await mobile.getByRole("button", { name: "Simpan" }).click();
    await mobile.getByText("Tim diperbarui.").waitFor();
    await sup.reload();
    await sup.locator("section", { hasText: "Aplikasi Android/iOS" }).getByText("Lewat jadwal").waitFor();
    check("jadwal: status 'Lewat jadwal' di admin", true);

    const guest = (await newSession(browser)).page;
    await guest.goto(BASE);
    await guest.getByText("Tim yang membuka magang").waitFor();
    check("jadwal: tim lewat jadwal tidak tampil di landing", (await guest.getByText("Mobile Development").count()) === 0);

    const ui = sup.locator("section", { hasText: "Riset pengguna" }).first();
    await ui.getByText("Edit tim").click();
    await ui.locator('input[name="quota"]').fill("1");
    await ui.locator('input[name="regClosesAt"]').fill(plusDays(30));
    await ui.getByRole("button", { name: "Simpan" }).click();
    await ui.getByText("Tim diperbarui.").waitFor();
    await guest.goto(BASE);
    await guest.getByText(/Kuota 1 orang/).waitFor();
    check("landing: info kuota & tanggal tutup tampil", (await guest.getByText(/Tutup \d+/).count()) > 0);
    await sup.screenshot({ path: `${shots}/tim-kuota.png`, fullPage: true });
  });

  let fajar: Page;
  await test.step("pendaftaran dengan dokumen & kuota", async () => {
    fajar = (await newSession(browser)).page;
    await fajar.goto(`${BASE}/daftar`);
    await fajar.fill("#f-name", "Fajar Nugroho");
    await fajar.fill("#f-email", "fajar@test.local");
    await fajar.fill("#f-password", "Rahasia123");
    await fajar.fill("#f-confirm", "Rahasia123");
    await fajar.click('form button[type="submit"]');
    await fajar.waitForURL("**/pendaftaran");
    await fajar.waitForLoadState("networkidle");
    check("form: tim lewat jadwal tidak bisa dipilih", (await fajar.getByRole("radio", { name: /Mobile Development/ }).count()) === 0);

    await fajar.getByRole("radio", { name: /UI\/UX Design/ }).check();
    await fajar.fill("#f-startDate", today);
    await fajar.fill("#f-endDate", plusDays(20));
    await fajar.fill("#f-motivation", "Ingin belajar riset pengguna dan desain antarmuka.");
    await fajar.click('main button[type="submit"]');
    await fajar.locator("#f-cv-err").waitFor();
    check("dokumen: CV & surat pengantar wajib (Mandiri)", (await fajar.locator("#f-coverLetter-err").count()) === 1);
    await fajar.getByRole("radio", { name: /MagangHub/ }).check();
    check("dokumen: surat pengantar disembunyikan untuk MagangHub", (await fajar.locator("#f-coverLetter").count()) === 0);
    await fajar.getByRole("radio", { name: /Mandiri/ }).check();

    await fajar.setInputFiles("#f-cv", { name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("bukan pdf sebenarnya") });
    await fajar.setInputFiles("#f-coverLetter", { name: "besar.pdf", mimeType: "application/pdf", buffer: Buffer.concat([PDF, Buffer.alloc(2.2 * 1024 * 1024)]) });
    await fajar.click('main button[type="submit"]');
    await fajar.getByText("Format harus PDF, JPG, atau PNG").waitFor();
    check("dokumen: tipe dicek dari isi file", true);
    check("dokumen: ukuran > 2 MB ditolak", (await fajar.getByText("Ukuran maksimal 2 MB").count()) === 1);

    await uploadDocs(fajar);
    await fajar.click('main button[type="submit"]');
    await fajar.getByText(/Kuota tim UI\/UX Design sudah penuh/).waitFor();
    check("kuota: pendaftaran ditolak saat kuota penuh", true);

    await fajar.getByRole("radio", { name: /Web Development/ }).check();
    await uploadDocs(fajar);
    await fajar.click('main button[type="submit"]');
    await fajar.getByText("Pendaftaran terkirim").waitFor();
    await fajar.getByRole("list", { name: "Dokumen pendaftaran" }).getByText("CV").waitFor();
    check("dokumen tampil di riwayat pendaftaran", (await fajar.getByText("Surat pengantar").count()) > 0);
    await fajar.screenshot({ path: `${shots}/pendaftaran-dokumen.png`, fullPage: true });
  });

  await test.step("akses dokumen & persetujuan melebihi kuota", async () => {
    const docs = await sql(
      `SELECT d.id FROM "Document" d JOIN "Registration" r ON r.id=d."registrationId" JOIN "User" u ON u.id=r."userId" WHERE u.email='fajar@test.local' AND d.kind='CV'`,
    );
    const url = `${BASE}/api/berkas/dokumen/${docs[0].id}`;
    const own = await fajar.request.get(url);
    check("dokumen: pemilik bisa membuka (PDF)", own.status() === 200 && own.headers()["content-type"] === "application/pdf");
    check("dokumen: header nosniff", own.headers()["x-content-type-options"] === "nosniff");
    check("dokumen: admin tim terkait bisa membuka (pendaftaran menunggu)", (await status(web, url)) === 200);
    check("dokumen: admin tim lain ditolak", (await status(mob, url)) === 404);
    check("dokumen: peserta lain ditolak", (await status(nadia, url)) === 404);

    const quotaNow = Number(
      (
        await sql(
          `SELECT count(*)::int AS n FROM "Registration" r JOIN "Team" t ON t.id=r."teamId" WHERE t.name='Web Development' AND r.status='APPROVED' AND r."startDate"<=$2::date AND r."endDate">=$1::date`,
          [today, plusDays(20)],
        )
      )[0].n,
    );
    await sql(`UPDATE "Team" SET quota=$1 WHERE name='Web Development'`, [quotaNow]);
    await web.goto(`${BASE}/admin/pendaftaran`);
    const card = web.locator("section:visible", { hasText: "Fajar Nugroho" }).first();
    await card.getByText(`Kuota tim pada periode ini: ${quotaNow}/${quotaNow} terisi (penuh)`).waitFor();
    check("kuota: info kuota penuh di kartu pendaftaran", true);
    await card.getByRole("button", { name: "Setujui" }).click();
    await card.getByText(/Kuota tim Web Development penuh/).waitFor();
    check("kuota: admin tidak bisa menyetujui melebihi kuota", true);
    await sql(`UPDATE "Team" SET quota=NULL WHERE name='Web Development'`);
    await card.getByRole("button", { name: "Setujui" }).click();
    await web.getByText("Pendaftaran disetujui.").or(card.getByText("Disetujui", { exact: true })).first().waitFor().catch(() => {});
    const st = await sql(`SELECT r.status FROM "Registration" r JOIN "User" u ON u.id=r."userId" WHERE u.email='fajar@test.local'`);
    check("kuota dilepas: pendaftaran bisa disetujui", st[0]?.status === "APPROVED");
  });

  await test.step("swafoto absen", async () => {
    const gita = (await newSession(browser)).page;
    await login(gita, "gita@test.local", "Rahasia123");
    await loggedIn(gita);
    await gita.goto(`${BASE}/absensi`);
    await gita.getByText("dalam jangkauan", { exact: false }).first().waitFor();
    await takeSelfie(gita);
    await gita.screenshot({ path: `${shots}/swafoto.png` });
    await gita.getByRole("button", { name: "Absen masuk" }).click();
    await gita.getByRole("button", { name: "Absen pulang" }).waitFor();
    const att = await sql(
      `SELECT a.id FROM "Attendance" a WHERE a."userId"='e2e_gita' AND a."checkInPhotoKey" IS NOT NULL LIMIT 1`,
    );
    check("swafoto tersimpan saat absen", att.length === 1);
    const url = `${BASE}/api/berkas/absen/${att[0]?.id}/masuk`;
    const r = await web.request.get(url);
    check("swafoto: admin tim terkait bisa melihat (JPEG)", r.status() === 200 && r.headers()["content-type"] === "image/jpeg");
    check("swafoto: admin tim lain ditolak", (await status(mob, url)) === 404);
    check("swafoto: peserta lain ditolak", (await status(nadia, url)) === 404);
    await web.goto(`${BASE}/admin/absensi`);
    await web.getByText("Gita Permata").first().waitFor();
    check("monitor absensi: tautan swafoto tersedia", (await web.getByRole("link", { name: "Swafoto masuk Gita Permata" }).count()) === 1);
    await web.screenshot({ path: `${shots}/monitor-absensi.png`, fullPage: true });

    // Swafoto opsional: absen pulang tanpa foto.
    await sup.goto(`${BASE}/admin/pengaturan`);
    await sup.waitForLoadState("networkidle");
    await sup.getByLabel("Wajib swafoto saat absen masuk & pulang").uncheck();
    await sup.getByRole("button", { name: "Simpan pengaturan" }).click();
    await sup.getByText("Pengaturan lokasi & jam kerja disimpan.").waitFor();
    const raka = (await newSession(browser)).page;
    await login(raka, "raka@demo.local");
    await loggedIn(raka);
    await raka.goto(`${BASE}/absensi`);
    await raka.getByText("dalam jangkauan", { exact: false }).first().waitFor();
    check("swafoto opsional: kamera tidak ditampilkan", (await raka.getByRole("button", { name: "Buka kamera" }).count()) === 0);
    await raka.getByRole("button", { name: "Absen pulang" }).click();
    await raka.getByText("Absensi hari ini sudah lengkap").waitFor();
    check("swafoto opsional: absen pulang tanpa foto berhasil", true);
    await sup.getByLabel("Wajib swafoto saat absen masuk & pulang").check();
    await sup.getByRole("button", { name: "Simpan pengaturan" }).click();
    await sup.getByText("Pengaturan lokasi & jam kerja disimpan.").waitFor();
  });

  await test.step("laporan akhir magang", async () => {
    const dimas = (await newSession(browser)).page;
    await login(dimas, "dimas@demo.local");
    await loggedIn(dimas);
    await dimas.goto(`${BASE}/sertifikat`);
    await dimas.getByRole("link", { name: "Laporan akhir" }).click();
    await dimas.waitForURL("**/cetak/laporan/*");
    const url = dimas.url();
    const report = dimas.getByRole("article", { name: /Laporan magang Dimas Saputra/ });
    await report.waitFor();
    const text = (await report.textContent()) ?? "";
    check("laporan: judul akhir & identitas", text.includes("Laporan Akhir Magang") && text.includes("Universitas Gadjah Mada"));
    check("laporan: rekap kehadiran & evaluasi", text.includes("Rekap kehadiran") && text.includes("Nilai akhir") && text.includes("Sangat baik"));
    check("laporan: baris sertifikat", /No\. \d{3}\/MAGANG\//.test(text) || text.includes("Belum terbit"));
    await dimas.screenshot({ path: `${shots}/laporan.png`, fullPage: true });
    await dimas.emulateMedia({ media: "print" });
    check("laporan (print): toolbar disembunyikan", !(await dimas.getByRole("button", { name: /Cetak/ }).isVisible()));
    await dimas.emulateMedia({ media: "screen" });

    check("laporan: admin tim terkait bisa membuka", (await status(web, url)) === 200 && (await (await web.request.get(url)).text()).includes("Dimas Saputra"));
    await mob.goto(url);
    await mob.getByText("Halaman tidak ditemukan").waitFor();
    check("laporan: admin tim lain ditolak", (await mob.getByRole("article").count()) === 0);
    await nadia.goto(url);
    await nadia.getByText("Halaman tidak ditemukan").waitFor();
    check("laporan: peserta lain ditolak", (await nadia.getByRole("article").count()) === 0);

    await nadia.goto(`${BASE}/sertifikat`);
    await nadia.getByRole("link", { name: "Laporan sementara" }).click();
    await nadia.getByText("Laporan Sementara Magang").waitFor();
    check("laporan sementara untuk periode berjalan", true);
  });

  await test.step("log admin", async () => {
    await sup.goto(`${BASE}/admin/log`);
    await sup.waitForLoadState("networkidle");
    const body = await sup.locator("main").innerText();
    for (const a of ["Mengoreksi absensi", "Menambah hari libur", "Menghapus hari libur", "Mengubah tim", "Menyetujui pendaftaran"]) {
      check(`log: tercatat "${a}"`, body.includes(a));
    }
    await sup.getByRole("combobox", { name: "Filter tindakan" }).fill("Mengoreksi");
    await sup.getByRole("option", { name: "Mengoreksi absensi" }).click();
    await sup.getByRole("button", { name: "Terapkan" }).click();
    await sup.waitForURL(/action=attendance\.correct/);
    const rows = await sup.locator("tbody tr").allInnerTexts();
    check("log: filter tindakan", rows.length >= 1 && rows.every((r) => r.includes("Mengoreksi absensi")) && rows[0].includes("Nadia"));
    await sup.screenshot({ path: `${shots}/log.png`, fullPage: true });

    await mob.goto(`${BASE}/admin/log`);
    await mob.getByRole("heading", { name: "Log admin" }).waitFor();
    await mob.locator("table").or(mob.getByText("Belum ada catatan")).first().waitFor();
    const mobBody = await mob.locator("main").innerText();
    check("log: admin tim lain tidak melihat log tim Web Development", !mobBody.includes("Nadia Putri"));
    await web.goto(`${BASE}/admin/log`);
    await web.locator("tbody tr").first().waitFor();
    check("log: admin tim melihat log timnya", (await web.locator("main").innerText()).includes("Nadia Putri"));
  });

});

test.afterAll(async () => {
  // Kembalikan pengaturan agar run berikutnya bersih.
  await sql(`UPDATE "Team" SET quota=NULL, "regOpensAt"=NULL, "regClosesAt"=NULL`);
  await sql(`UPDATE "OfficeSetting" SET "requireSelfie"=true WHERE id=1`);
  void PNG;
});
