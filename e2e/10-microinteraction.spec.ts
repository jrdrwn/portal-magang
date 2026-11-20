import { test, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { BASE, check, loggedIn, login, newSession, plusDays, resetDemoAccounts, shotsDir, sql, takeSelfie } from "./helpers";

test.describe.configure({ mode: "serial" });

const MIA = { id: "e2e_mia", email: "mia@test.local", password: "Rahasia123" };
const motion = { reducedMotion: "no-preference" as const };

/** Nilai CSS terhitung dari elemen pertama yang cocok. */
const css = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

const strip = (p: Page) => p.getByRole("region", { name: "Langkah hari ini" });

test("Microinteraction: animasi, umpan balik, dan kurangi gerakan", async ({ browser }) => {
  await resetDemoAccounts();
  const shots = shotsDir("microinteraction");
  await sql(`DELETE FROM "User" WHERE email=$1`, [MIA.email]);
  await sql(`DELETE FROM "Holiday" WHERE date = (now() AT TIME ZONE 'Asia/Jakarta')::date`);
  await sql(
    `INSERT INTO "User" (id, email, name, "passwordHash", role, "isActive", reminders, "updatedAt") VALUES ($1,$2,'Mia Lestari',$3,'INTERN',true,false,now())`,
    [MIA.id, MIA.email, bcrypt.hashSync(MIA.password, 10)],
  );
  await sql(
    `INSERT INTO "Registration" (id, "userId", "teamId", type, "startDate", "endDate", motivation, status)
     SELECT 'e2e_mia_reg', $1, t.id, 'MANDIRI', $2::date, $3::date, 'Data uji', 'APPROVED' FROM "Team" t WHERE t.name='Web Development'`,
    [MIA.id, plusDays(-3), plusDays(40)],
  );

  // ---------- Kurangi gerakan: animasi praktis nol, tanpa konfeti ----------
  {
    const { ctx, page } = await newSession(browser);
    await login(page, MIA.email, MIA.password);
    await loggedIn(page);
    await page.locator("#konten > *").first().waitFor();
    const dur = await css(page, "#konten > *", "animation-duration");
    check("reduced motion: animasi masuk halaman dimatikan", parseFloat(dur) < 0.001, dur);
    await ctx.close();
  }

  const { ctx, page } = await newSession(browser, undefined, undefined, motion);
  await login(page, MIA.email, MIA.password);
  await loggedIn(page);

  // ---------- Animasi masuk halaman ----------
  await page.locator("#konten > *").first().waitFor();
  check("halaman: konten memakai animasi enter", (await css(page, "#konten > *", "animation-name")) === "enter");
  check("halaman: durasi animasi enter 260ms", (await css(page, "#konten > *", "animation-duration")) === "0.26s");

  // ---------- Absen masuk: jam baru diberi animasi pop ----------
  await page.goto(`${BASE}/absensi`);
  await page.getByText("dalam jangkauan", { exact: false }).first().waitFor({ timeout: 15000 });
  await takeSelfie(page);
  await page.getByRole("button", { name: "Absen masuk" }).click();
  await page.getByText("Absen masuk tercatat").waitFor();
  const fresh = page.locator("[data-baru]");
  await fresh.first().waitFor();
  check("absen: jam masuk baru pop", (await css(page, "[data-baru]", "animation-name")) === "pop");
  check("absen: pesan sukses pop-in", (await css(page, '[role="status"]', "animation-name")) === "pop-in");
  check("absen: ikon centang digambar", (await css(page, '[role="status"] path', "animation-name")) === "draw");
  await strip(page).getByText("1/3").waitFor();
  check("langkah: ikon selesai pop", (await css(page, '[data-step-state="done"]', "animation-name")) === "pop");

  // ---------- Semua langkah selesai: konfeti sekali per hari ----------
  await sql(
    `INSERT INTO "Activity" (id, "userId", "attendanceId", date, type, title)
     SELECT 'e2e_mia_act', a."userId", a.id, a.date, 'WORK', 'Uji microinteraction' FROM "Attendance" a WHERE a."userId"=$1`,
    [MIA.id],
  );
  await sql(`UPDATE "Attendance" SET "checkOutAt"=now() WHERE "userId"=$1`, [MIA.id]);
  await page.goto(`${BASE}/dashboard`);
  await strip(page).getByText("3/3").waitFor();
  const burst = page.getByTestId("rayakan");
  await burst.waitFor({ state: "attached", timeout: 5000 });
  check("rayakan: konfeti muncul saat 3/3", (await burst.locator("span").count()) === 14);
  check("rayakan: counter pop", (await css(page, '[data-testid="langkah-counter"]', "animation-name")) === "pop");
  await page.screenshot({ path: `${shots}/rayakan.png` });
  await burst.waitFor({ state: "detached", timeout: 5000 });
  check("rayakan: konfeti hilang sendiri", true);
  await page.reload();
  await strip(page).getByText("3/3").waitFor();
  await page.waitForTimeout(800);
  check("rayakan: tidak diulang di hari yang sama", (await burst.count()) === 0);

  // ---------- Lonceng: badge pop & ikon bergoyang saat ada notifikasi baru ----------
  await page.waitForResponse((r) => r.url().includes("/api/notifikasi")).catch(() => {});
  await page.waitForTimeout(500);
  await sql(
    `INSERT INTO "Notification" (id, "userId", type, title, body) VALUES ('e2e_mia_n1', $1, 'DAILY_REMINDER', 'Uji lonceng', 'Notifikasi uji')`,
    [MIA.id],
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.locator('[data-ring="1"]').first().waitFor({ state: "attached" });
  check("lonceng: ikon bergoyang", (await css(page, '[data-ring="1"]', "animation-name")) === "wiggle");
  check("lonceng: badge pop", (await css(page, '[data-testid="lonceng-badge"]', "animation-name")) === "pop");
  await page.getByRole("button", { name: /Notifikasi, 1 belum dibaca/ }).first().click();
  await page.getByRole("dialog", { name: "Notifikasi" }).waitFor();
  check("lonceng: popover pop-in", (await css(page, '[role="dialog"][aria-label="Notifikasi"]', "animation-name")) === "pop-in");
  await page.keyboard.press("Escape");

  // ---------- Saklar pengingat: knop bergeser ----------
  await page.goto(`${BASE}/profil`);
  const sw = page.getByRole("switch", { name: "Pengingat harian" });
  const knob = page.getByTestId("switch-knob");
  check("saklar: awal mati", !(await sw.isChecked()));
  const before = await knob.evaluate((el) => getComputedStyle(el).translate);
  await sw.check();
  await page.getByText("Pengingat harian aktif.").waitFor();
  await page.waitForTimeout(400);
  const after = await knob.evaluate((el) => getComputedStyle(el).translate);
  check("saklar: knop bergeser saat aktif", before !== after && after.startsWith("20px"), `${before} -> ${after}`);
  check("saklar: tersimpan", (await sql(`SELECT reminders FROM "User" WHERE id=$1`, [MIA.id]))[0].reminders === true);
  await page.screenshot({ path: `${shots}/saklar.png` });
  await ctx.close();

  // ---------- HP: lembar Menu naik & tab menekan ----------
  {
    const m = await newSession(browser, { width: 390, height: 844 }, undefined, motion);
    await login(m.page, MIA.email, MIA.password);
    await loggedIn(m.page);
    const menu = m.page.getByRole("button", { name: "Menu" });
    await menu.hover();
    await m.page.mouse.down();
    await m.page.waitForTimeout(250);
    const scale = await menu.evaluate((el) => getComputedStyle(el).scale);
    await m.page.mouse.up();
    check("tab: mengecil saat ditekan", scale === "0.95", scale);
    await m.page.getByRole("dialog", { name: "Semua menu" }).waitFor();
    check("menu: lembar naik (sheet-up)", (await css(m.page, 'dialog[aria-label="Semua menu"]', "animation-name")) === "sheet-up");
    await m.ctx.close();
  }

  // ---------- Salin password sementara ----------
  {
    const a = await newSession(browser, undefined, undefined, motion);
    await a.ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    await login(a.page, "admin.web@demo.local");
    await loggedIn(a.page);
    a.page.once("dialog", (d) => d.accept());
    await a.page.goto(`${BASE}/admin/peserta/${MIA.id}`);
    await a.page.getByRole("button", { name: "Reset password" }).click();
    const msg = await a.page.getByText(`Password sementara untuk ${MIA.email}`).textContent();
    const temp = msg?.match(/: (\S+) —/)?.[1] ?? "";
    const copy = a.page.getByRole("button", { name: `Salin ${temp}` });
    await copy.click();
    await a.page.getByRole("button", { name: "Tersalin" }).waitFor();
    const clip = await a.page.evaluate(() => navigator.clipboard.readText());
    check("salin: password sementara tersalin", clip === temp, clip);
    await a.page.screenshot({ path: `${shots}/salin.png` });
    await a.page.getByRole("button", { name: `Salin ${temp}` }).waitFor({ timeout: 4000 });
    check("salin: label kembali ke Salin", true);
    await a.ctx.close();
  }

  await sql(`DELETE FROM "User" WHERE id=$1`, [MIA.id]);
});
