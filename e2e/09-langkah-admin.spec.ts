import { test, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { E2E_CRON_SECRET } from "../playwright.config";
import { BASE, check, dateKey, loggedIn, login, newSession, plusDays, resetDemoAccounts, shotsDir, sql } from "./helpers";

test.describe.configure({ mode: "serial" });

const wibMinutes = () => {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date())
    .split(":")
    .map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
async function setTimes(start: number, late: number, end: number) {
  const now = wibMinutes();
  const vals = [now + start, now + late, now + end];
  if (vals.some((v) => v < 0 || v > 23 * 60 + 59)) return false;
  await sql(`UPDATE "OfficeSetting" SET "workStart"=$1, "lateAfter"=$2, "workEnd"=$3 WHERE id=1`, vals.map(hhmm));
  return true;
}

/** Jumlah peserta aktif tim yang belum punya catatan absen hari ini. */
async function notYetCount(team: string) {
  const r = await sql(
    `SELECT count(DISTINCT u.id)::int AS n FROM "User" u JOIN "Registration" r ON r."userId"=u.id JOIN "Team" t ON t.id=r."teamId"
     WHERE t.name=$1 AND r.status='APPROVED' AND r."startDate"<=$2::date AND r."endDate">=$2::date AND u."isActive" AND u.role='INTERN'
       AND NOT EXISTS (SELECT 1 FROM "Attendance" a WHERE a."userId"=u.id AND a.date=$2::date)`,
    [team, dateKey()],
  );
  return r[0].n as number;
}

const strip = (p: Page) => p.getByRole("region", { name: "Langkah hari ini" });

test("Langkah hari ini & pengingat untuk admin", async ({ browser, request }) => {
  await resetDemoAccounts();
  const shots = shotsDir("langkah-admin");
  await sql(`DELETE FROM "User" WHERE email IN ('joko@test.local','lina@test.local')`);
  await sql(`DELETE FROM "Notification" WHERE type='DAILY_REMINDER'`);
  await sql(`DELETE FROM "ReminderSent"`);
  await sql(`DELETE FROM "Holiday" WHERE date = (now() AT TIME ZONE 'Asia/Jakarta')::date`);
  await sql(`UPDATE "Registration" SET status='REJECTED' WHERE status='PENDING'`);
  const hash = bcrypt.hashSync("Rahasia123", 10);
  // Joko: peserta aktif Web Development, belum absen. Lina: pendaftar baru (menunggu) ke Web Development.
  for (const [id, email, name, status, start] of [
    ["e2e_joko", "joko@test.local", "Joko Santoso", "APPROVED", plusDays(-3)],
    ["e2e_lina", "lina@test.local", "Lina Marlina", "PENDING", plusDays(1)],
  ]) {
    await sql(`INSERT INTO "User" (id, email, name, "passwordHash", role, "isActive", "updatedAt") VALUES ($1,$2,$3,$4,'INTERN',true,now())`, [id, email, name, hash]);
    await sql(
      `INSERT INTO "Registration" (id, "userId", "teamId", type, "startDate", "endDate", motivation, status)
       SELECT $1 || '_reg', $1, t.id, 'MANDIRI', $2::date, $3::date, 'Data uji', $4 FROM "Team" t WHERE t.name='Web Development'`,
      [id, start, plusDays(40), status],
    );
  }
  test.skip(!(await setTimes(-60, -40, 120)), "Jam kerja relatif melewati tengah malam WIB.");

  const web = (await newSession(browser)).page;
  await login(web, "admin.web@demo.local");
  await loggedIn(web);
  const mob = (await newSession(browser)).page;
  await login(mob, "admin.mobile@demo.local");
  await loggedIn(mob);

  await test.step("langkah: pendaftaran menunggu & kehadiran", async () => {
    await web.goto(`${BASE}/admin`);
    await strip(web).waitFor();
    const t = await strip(web).innerText();
    check("strip admin: pendaftaran 1 menunggu", t.includes("Tinjau pendaftaran") && t.includes("1 menunggu"), t.replace(/\n/g, " | "));
    const notYet = await notYetCount("Web Development");
    check("strip admin: jumlah belum absen sesuai data tim", t.includes(`${notYet} belum absen`), `${notYet} | ${t.replace(/\n/g, " | ")}`);
    check("strip admin: aktivitas menunggu jam pulang", t.includes("Periksa aktivitas") && t.includes("setelah"));
    check("langkah berikutnya: Tinjau pendaftaran", (await strip(web).getByRole("link").innerText()).includes("Tinjau pendaftaran"));
    await web.screenshot({ path: `${shots}/admin-awal.png` });

    const day = Number(dateKey().slice(8, 10));
    const evalShown = t.includes("Evaluasi ");
    check("langkah evaluasi hanya di akhir/awal bulan", day >= 25 || day <= 5 ? true : !evalShown, `tgl ${day}, tampil=${evalShown}`);

    await mob.goto(`${BASE}/admin`);
    await strip(mob).waitFor();
    const tm = await strip(mob).innerText();
    check("admin tim lain: pendaftaran Web tidak dihitung", tm.includes("tidak ada antrean"), tm.replace(/\n/g, " | "));
    check("admin tim lain: jumlah belum absen timnya sendiri", tm.includes(`${await notYetCount("Mobile Development")} belum absen`) || tm.includes("semua tercatat"));

    // Setujui pendaftaran -> langkah pertama selesai, berikutnya cek kehadiran.
    await sql(`UPDATE "Registration" SET status='APPROVED', "reviewedAt"=now() WHERE id='e2e_lina_reg'`);
    await web.reload();
    await strip(web).waitFor();
    check("setelah ditinjau: langkah 1 selesai", (await strip(web).innerText()).includes("tidak ada antrean"));
    check("berikutnya: Cek kehadiran", (await strip(web).getByRole("link").innerText()).includes("Cek kehadiran"));
    await strip(web).getByRole("link", { name: /Cek kehadiran/ }).click();
    await web.waitForURL("**/admin/absensi");
    check("tombol menuju monitor absensi", true);
  });

  await test.step("langkah: periksa aktivitas setelah jam pulang", async () => {
    await sql(
      `INSERT INTO "Attendance" (id, "userId", date, status, "checkInAt") VALUES ('e2e_att_joko', 'e2e_joko', (now() AT TIME ZONE 'Asia/Jakarta')::date, 'PRESENT', now())
       ON CONFLICT ("userId", date) DO NOTHING`,
    );
    await setTimes(-300, -280, -10);
    await web.goto(`${BASE}/admin`);
    await strip(web).waitFor();
    const t = await strip(web).innerText();
    check("aktivitas: Joko belum mencatat terhitung", /\d+ belum mencatat/.test(t), t.replace(/\n/g, " | "));
    await web.screenshot({ path: `${shots}/admin-aktivitas.png` });
  });

  await test.step("pengingat admin via cron", async () => {
    await setTimes(-120, -60, 120); // 60 menit setelah batas terlambat
    await sql(`UPDATE "Registration" SET status='PENDING', "reviewedAt"=NULL WHERE id='e2e_lina_reg'`);
    await sql(`UPDATE "User" SET reminders=false WHERE email='admin.uiux@demo.local'`);
    await sql(`DELETE FROM "Notification" WHERE type='DAILY_REMINDER'`);
    await sql(`DELETE FROM "ReminderSent"`);

    const r = await request.get(`${BASE}/api/cron/pengingat`, { headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` } });
    const j = await r.json();
    check("cron: 200 & ada ringkasan admin", r.status() === 200 && typeof j.admin?.sent === "number", JSON.stringify(j));
    const rows = await sql(
      `SELECT u.email, n.title FROM "Notification" n JOIN "User" u ON u.id=n."userId" WHERE n.type='DAILY_REMINDER' AND u.role <> 'INTERN' ORDER BY 1,2`,
    );
    const of = (email: string) => rows.filter((x) => x.email === email).map((x) => x.title);
    const webNotYet = await notYetCount("Web Development");
    check("admin tim Web: pengingat pendaftaran", of("admin.web@demo.local").includes("1 pendaftaran menunggu"), JSON.stringify(of("admin.web@demo.local")));
    check(
      "admin tim Web: pengingat belum absen (jumlah tim)",
      webNotYet === 0 || of("admin.web@demo.local").includes(`${webNotYet} peserta belum absen`),
      `${webNotYet} | ${JSON.stringify(of("admin.web@demo.local"))}`,
    );
    check("admin tim Mobile: tidak dapat pengingat pendaftaran Web", !of("admin.mobile@demo.local").some((x) => x.includes("pendaftaran")));
    check("admin utama: mendapat pengingat pendaftaran semua tim", of("admin@magang.local").some((x) => x.includes("pendaftaran menunggu")));
    check("pengingat dimatikan (admin UI/UX): tidak dikirim", of("admin.uiux@demo.local").length === 0);

    const r2 = await (await request.get(`${BASE}/api/cron/pengingat`, { headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` } })).json();
    check("cron kedua: tidak ada pengingat admin ganda", r2.admin.sent === 0, JSON.stringify(r2.admin));

    await web.goto(`${BASE}/admin`);
    await web.locator("aside").getByRole("button", { name: /^Notifikasi/ }).click();
    await web.getByRole("dialog", { name: "Notifikasi" }).getByText("1 pendaftaran menunggu").waitFor();
    check("lonceng admin menampilkan pengingat", true);
    await web.screenshot({ path: `${shots}/lonceng-admin.png` });
  });

  await test.step("pengaturan pengingat admin", async () => {
    await web.keyboard.press("Escape");
    await web.goto(`${BASE}/admin/akun-saya`);
    await web.waitForLoadState("networkidle");
    await web.getByText("Pendaftaran menunggu, peserta yang belum absen").waitFor();
    await web.getByRole("switch", { name: "Pengingat harian" }).uncheck();
    await web.getByText("Pengingat harian dimatikan.").waitFor();
    check("admin mematikan pengingat", (await sql(`SELECT reminders FROM "User" WHERE email='admin.web@demo.local'`))[0].reminders === false);
    await web.screenshot({ path: `${shots}/akun-saya.png`, fullPage: true });
  });

  await test.step("HP: strip admin tampil", async () => {
    const m = (await newSession(browser, { width: 390, height: 844 })).page;
    await login(m, "admin@magang.local", "Admin#12345");
    await loggedIn(m);
    await strip(m).waitFor();
    const w = await m.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: window.innerWidth }));
    check("HP: strip admin tidak melebar", w.doc <= w.view, JSON.stringify(w));
    await m.screenshot({ path: `${shots}/hp-admin.png` });
  });

  await sql(`UPDATE "OfficeSetting" SET "workStart"='08:00', "lateAfter"='08:15', "workEnd"='16:00' WHERE id=1`);
  await sql(`UPDATE "User" SET reminders=true`);
  await sql(`DELETE FROM "User" WHERE email IN ('joko@test.local','lina@test.local')`);
});
