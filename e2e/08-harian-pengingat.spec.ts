import { expect, test, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { createDecipheriv, createECDH, createHmac, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:https";
import type { AddressInfo } from "node:net";
import selfsigned from "selfsigned";
import { E2E_CRON_SECRET } from "../playwright.config";
import { BASE, check, dateKey, loggedIn, login, newSession, plusDays, resetDemoAccounts, shotsDir, sql, takeSelfie } from "./helpers";

test.describe.configure({ mode: "serial" });

/** Menit sejak 00:00 WIB. */
const wibMinutes = () => {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date())
    .split(":")
    .map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Atur jam kerja relatif terhadap sekarang (menit). */
async function setTimes(start: number, late: number, end: number) {
  const now = wibMinutes();
  const vals = [now + start, now + late, now + end];
  if (vals.some((v) => v < 0 || v > 23 * 60 + 59)) return false;
  await sql(`UPDATE "OfficeSetting" SET "workStart"=$1, "lateAfter"=$2, "workEnd"=$3 WHERE id=1`, vals.map(hhmm));
  return true;
}

// ---------- Server push tiruan (HTTPS) + dekripsi aes128gcm (RFC 8291) ----------
type Received = { path: string; headers: Record<string, string | string[] | undefined>; payload: { title: string; body: string; url?: string } | null };

function decrypt(body: Buffer, uaPrivate: ReturnType<typeof createECDH>, authSecret: Buffer) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const ciphertext = body.subarray(21 + idlen);
  const uaPublic = uaPrivate.getPublicKey();
  const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();
  const ecdh = uaPrivate.computeSecret(asPublic);
  const prkKey = hmac(authSecret, ecdh);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ciphertext.subarray(-16));
  const plain = Buffer.concat([d.update(ciphertext.subarray(0, -16)), d.final()]);
  const end = plain.lastIndexOf(2);
  return JSON.parse(plain.subarray(0, end).toString("utf8"));
}

async function startPushServer() {
  const pems = await selfsigned.generate([{ name: "commonName", value: "localhost" }], { keySize: 2048 });
  const received: Received[] = [];
  const keys = new Map<string, { ecdh: ReturnType<typeof createECDH>; auth: Buffer }>();
  const server: Server = createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const path = req.url ?? "";
      if (path.startsWith("/gone/")) {
        res.writeHead(410).end();
        return;
      }
      const k = keys.get(path);
      let payload = null;
      try {
        payload = k ? decrypt(Buffer.concat(chunks), k.ecdh, k.auth) : null;
      } catch {
        payload = null;
      }
      received.push({ path, headers: req.headers, payload });
      res.writeHead(201).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  /** Buat langganan dengan kunci asli supaya isi push bisa didekripsi. */
  const subscription = (path: string) => {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const auth = randomBytes(16);
    keys.set(path, { ecdh, auth });
    return { endpoint: `https://localhost:${port}${path}`, p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") };
  };
  return { server, received, subscription };
}

test("Menu harian, langkah hari ini, pengingat & push", async ({ browser, request }) => {
  await resetDemoAccounts();
  const shots = shotsDir("harian");
  await sql(`DELETE FROM "User" WHERE email IN ('hana@test.local','ika@test.local')`);
  await sql(`DELETE FROM "Notification" WHERE type='DAILY_REMINDER'`);
  await sql(`DELETE FROM "ReminderSent"`);
  await sql(`DELETE FROM "PushSubscription"`);
  await sql(`DELETE FROM "Holiday" WHERE date = (now() AT TIME ZONE 'Asia/Jakarta')::date`);
  await sql(`UPDATE "OfficeSetting" SET "requireSelfie"=true, latitude=-6.2088, longitude=106.8456, "radiusMeters"=150 WHERE id=1`);
  const hash = bcrypt.hashSync("Rahasia123", 10);
  for (const [id, email, name] of [
    ["e2e_hana", "hana@test.local", "Hana Kirana"],
    ["e2e_ika", "ika@test.local", "Ika Wulandari"],
  ]) {
    await sql(
      `INSERT INTO "User" (id, email, name, "passwordHash", role, "isActive", "updatedAt") VALUES ($1,$2,$3,$4,'INTERN',true,now())`,
      [id, email, name, hash],
    );
    await sql(
      `INSERT INTO "Registration" (id, "userId", "teamId", type, "startDate", "endDate", motivation, status, "reviewedAt")
       SELECT $1 || '_reg', $1, t.id, 'MANDIRI', $2::date, $3::date, 'Data uji', 'APPROVED', now() FROM "Team" t WHERE t.name='Web Development'`,
      [id, plusDays(-3), plusDays(30)],
    );
  }
  await sql(`DELETE FROM "Attendance" WHERE "userId"=(SELECT id FROM "User" WHERE email='salsa@demo.local') AND date=(now() AT TIME ZONE 'Asia/Jakarta')::date`);
  test.skip(!(await setTimes(-10, 30, 120)), "Jam kerja relatif melewati tengah malam WIB; jalankan di jam lain.");

  const push = await startPushServer();
  const cron = (auth?: string) =>
    request.get(`${BASE}/api/cron/pengingat`, { headers: auth ? { Authorization: auth } : {} });

  try {
    await test.step("navigasi HP berisi fitur harian", async () => {
      const m = (await newSession(browser, { width: 390, height: 844 })).page;
      await login(m, "hana@test.local", "Rahasia123");
      await loggedIn(m);
      await m.waitForLoadState("networkidle");
      const bottom = m.locator("nav[aria-label='Menu utama']").last();
      const tabs = (await bottom.locator("a, button").allInnerTexts()).map((t) => t.trim());
      check("HP peserta: Beranda, Aktivitas, Absensi (tengah), Notifikasi, Menu", tabs.join(",") === "Beranda,Aktivitas,Absensi,Notifikasi,Menu", tabs.join(","));
      const sizes = await bottom.locator("a").evaluateAll((els) => els.map((e) => e.querySelector("span")?.getBoundingClientRect().height ?? 0));
      check("HP peserta: tombol Absensi ditonjolkan", sizes[2] > sizes[0] + 10, sizes.join(","));
      await m.screenshot({ path: `${shots}/hp-peserta.png` });

      const a = (await newSession(browser, { width: 390, height: 844 })).page;
      await login(a, "admin.web@demo.local");
      await loggedIn(a);
      await a.waitForLoadState("networkidle");
      const atabs = (await a.locator("nav[aria-label='Menu utama']").last().locator("a, button").allInnerTexts()).map((t) => t.trim());
      check("HP admin: Ringkasan, Absensi, Aktivitas, Pendaftaran, Menu", atabs.join(",") === "Ringkasan,Absensi,Aktivitas,Pendaftaran,Menu", atabs.join(","));
    });

    let hana: Page;
    await test.step("langkah hari ini mengikuti progres", async () => {
      hana = (await newSession(browser)).page;
      await login(hana, "hana@test.local", "Rahasia123");
      await loggedIn(hana);
      const strip = hana.getByRole("region", { name: "Langkah hari ini" });
      await strip.waitFor();
      const stripText = await strip.innerText();
      check("awal: 0/3 & langkah berikutnya Absen masuk", stripText.includes("0/3") && (await strip.getByRole("link").innerText()).includes("Absen masuk"), stripText.replace(/\n/g, " | "));
      await hana.screenshot({ path: `${shots}/langkah-awal.png` });

      await strip.getByRole("link", { name: /Absen masuk/ }).click();
      await hana.waitForURL("**/absensi");
      await hana.getByText("dalam jangkauan", { exact: false }).first().waitFor();
      await takeSelfie(hana);
      await hana.getByRole("button", { name: "Absen masuk" }).click();
      await hana.getByRole("button", { name: "Absen pulang" }).waitFor();
      await strip.getByText("1/3").waitFor();
      check("setelah absen masuk: 1/3 & berikutnya Catat aktivitas", (await strip.getByRole("link").innerText()).includes("Catat aktivitas"));

      await strip.getByRole("link", { name: /Catat aktivitas/ }).click();
      await hana.waitForURL("**/aktivitas");
      await hana.fill("#f-title", "Menyusun komponen tabel");
      await hana.getByRole("button", { name: "Simpan aktivitas" }).click();
      await hana.getByText("Aktivitas ditambahkan.").waitFor();
      await strip.getByText("2/3").waitFor();
      check("setelah aktivitas: 2/3", true);

      await hana.locator("aside").getByRole("link", { name: "Beranda" }).click();
      await hana.waitForURL("**/dashboard");
      await hana.getByText("Status hari ini").first().waitFor();
      check("navigasi ke Beranda: strip tetap 2/3", (await strip.innerText()).includes("2/3"));
      await hana.screenshot({ path: `${shots}/langkah-progres.png` });
    });

    await test.step("izin & hari libur", async () => {
      const ika = (await newSession(browser)).page;
      await login(ika, "ika@test.local", "Rahasia123");
      await loggedIn(ika);
      await ika.goto(`${BASE}/absensi`);
      await ika.fill("#f-note", "Mengurus administrasi kampus");
      await ika.getByRole("button", { name: "Kirim laporan" }).click();
      await ika.getByText("Hari ini Anda tercatat izin").waitFor();
      await ika.getByRole("region", { name: "Langkah hari ini" }).getByText("Izin tercatat").waitFor();
      check("izin: strip menyatakan tidak perlu langkah lain", true);

      await sql(`INSERT INTO "Holiday" (id, date, name, kind) VALUES ('e2e_hol', $1::date, 'Libur uji', 'OFFICE') ON CONFLICT (date) DO NOTHING`, [dateKey()]);
      const salsa = (await newSession(browser)).page;
      await login(salsa, "salsa@demo.local");
      await loggedIn(salsa);
      await salsa.getByRole("region", { name: "Langkah hari ini" }).getByText("Tidak ada absen hari ini").waitFor();
      check("hari libur: strip menyatakan tidak ada absen", true);
      await hana.reload();
      await hana.getByRole("region", { name: "Langkah hari ini" }).getByText("2/3").waitFor();
      check("hari libur tapi sudah absen: langkah tetap tampil", true);
      await sql(`DELETE FROM "Holiday" WHERE id='e2e_hol'`);
    });

    await test.step("endpoint pengingat: keamanan", async () => {
      check("cron tanpa token: 401", (await cron()).status() === 401);
      check("cron token salah: 401", (await cron("Bearer salah")).status() === 401);
    });

    await test.step("pengingat absen masuk + push terenkripsi", async () => {
      const subOk = push.subscription("/push/demo-salsa");
      const subGone = push.subscription("/gone/lama");
      for (const [i, s] of [subOk, subGone].entries()) {
        await sql(
          `INSERT INTO "PushSubscription" (id, "userId", endpoint, p256dh, auth) SELECT $1, id, $2, $3, $4 FROM "User" WHERE email='salsa@demo.local'`,
          [`e2e_sub_${i}`, s.endpoint, s.p256dh, s.auth],
        );
      }
      await sql(`DELETE FROM "Attendance" WHERE "userId"=(SELECT id FROM "User" WHERE email='salsa@demo.local') AND date=(now() AT TIME ZONE 'Asia/Jakarta')::date`);
      await sql(`UPDATE "User" SET reminders=false WHERE email='raka@demo.local'`);
      // Hanya hitung pengingat dari cron (bukan dari lonceng saat login sebelumnya).
      await sql(`DELETE FROM "Notification" WHERE type='DAILY_REMINDER'`);
      await sql(`DELETE FROM "ReminderSent"`);

      const r1 = await cron(`Bearer ${E2E_CRON_SECRET}`);
      const j1 = await r1.json();
      check("cron: 200", r1.status() === 200 && j1.ok, JSON.stringify(j1));
      const rem = await sql(
        `SELECT u.email, n.title FROM "Notification" n JOIN "User" u ON u.id=n."userId" WHERE n.type='DAILY_REMINDER' ORDER BY u.email`,
      );
      const byEmail = Object.fromEntries(rem.map((r) => [r.email, r.title]));
      check("pengingat absen masuk untuk peserta yang belum absen", byEmail["salsa@demo.local"] === "Waktunya absen masuk", JSON.stringify(byEmail));
      check("tidak ada pengingat untuk yang sudah absen", !byEmail["nadia@demo.local"] && !byEmail["hana@test.local"]);
      check("tidak ada pengingat untuk yang izin", !byEmail["ika@test.local"]);
      check("pengingat dimatikan: tidak dikirim", !byEmail["raka@demo.local"]);

      await expect.poll(() => push.received.length).toBeGreaterThan(0);
      const got = push.received.find((r) => r.path === "/push/demo-salsa");
      check("push terkirim dengan VAPID & aes128gcm", got?.headers["content-encoding"] === "aes128gcm" && String(got?.headers.authorization).startsWith("vapid "));
      check("isi push terdekripsi benar", got?.payload?.title === "Waktunya absen masuk" && got?.payload?.url === "/absensi", JSON.stringify(got?.payload));
      const left = await sql(`SELECT endpoint FROM "PushSubscription" WHERE "userId"=(SELECT id FROM "User" WHERE email='salsa@demo.local')`);
      check("langganan kedaluwarsa (410) dihapus", left.length === 1 && left[0].endpoint === subOk.endpoint);

      const before = push.received.length;
      const r2 = await (await cron(`Bearer ${E2E_CRON_SECRET}`)).json();
      check("cron kedua: tidak ada pengingat ganda", r2.sent === 0 && push.received.length === before, JSON.stringify(r2));
    });

    await test.step("pengingat aktivitas & absen pulang", async () => {
      await sql(
        `INSERT INTO "Attendance" (id, "userId", date, status, "checkInAt") VALUES ('e2e_att_ika2', 'e2e_ika', (now() AT TIME ZONE 'Asia/Jakarta')::date, 'PRESENT', now())
         ON CONFLICT ("userId", date) DO UPDATE SET status='PRESENT', "checkInAt"=now(), note=NULL`,
      );
      await sql(`DELETE FROM "Activity" WHERE "userId"='e2e_ika'`);
      await setTimes(-120, -100, 30); // 30 menit sebelum jam pulang
      await cron(`Bearer ${E2E_CRON_SECRET}`);
      let t = await sql(`SELECT title FROM "Notification" WHERE "userId"='e2e_ika' AND type='DAILY_REMINDER'`);
      check("pengingat catat aktivitas", t.some((x) => x.title === "Jangan lupa catat aktivitas"), JSON.stringify(t));

      await setTimes(-300, -280, -20); // 20 menit setelah jam pulang
      await cron(`Bearer ${E2E_CRON_SECRET}`);
      t = await sql(`SELECT title FROM "Notification" WHERE "userId"='e2e_ika' AND type='DAILY_REMINDER'`);
      check("pengingat absen pulang", t.some((x) => x.title === "Jangan lupa absen pulang"), JSON.stringify(t));
      const h = await sql(`SELECT title FROM "Notification" WHERE "userId"='e2e_hana' AND type='DAILY_REMINDER'`);
      check("hana (sudah ada aktivitas, belum pulang): hanya pengingat pulang", h.length === 1 && h[0].title === "Jangan lupa absen pulang", JSON.stringify(h));
      const dup = await sql(`SELECT "userId", title, count(*)::int AS n FROM "Notification" WHERE type='DAILY_REMINDER' GROUP BY 1,2 HAVING count(*) > 1`);
      check("tidak ada pengingat ganda sama sekali", dup.length === 0, JSON.stringify(dup));
    });

    await test.step("pengingat di aplikasi saat membuka lonceng (tanpa push)", async () => {
      await setTimes(-10, 30, 120);
      await sql(`DELETE FROM "Notification" WHERE "userId"=(SELECT id FROM "User" WHERE email='salsa@demo.local') AND type='DAILY_REMINDER'`);
      await sql(`DELETE FROM "ReminderSent" WHERE "userId"=(SELECT id FROM "User" WHERE email='salsa@demo.local')`);
      const before = push.received.length;
      const salsa = (await newSession(browser)).page;
      await login(salsa, "salsa@demo.local");
      await loggedIn(salsa);
      await salsa.locator("aside").getByRole("button", { name: /^Notifikasi/ }).click();
      await salsa.getByRole("dialog", { name: "Notifikasi" }).getByText("Waktunya absen masuk").waitFor();
      check("lonceng memuat pengingat harian", true);
      await Promise.all(Array.from({ length: 5 }, () => salsa.request.get(`${BASE}/api/notifikasi`)));
      const n = await sql(`SELECT count(*)::int AS n FROM "Notification" n JOIN "User" u ON u.id=n."userId" WHERE u.email='salsa@demo.local' AND n.type='DAILY_REMINDER'`);
      check("permintaan lonceng bersamaan: tetap satu pengingat", n[0].n === 1, String(n[0].n));
      check("tanpa push saat aplikasi terbuka", push.received.length === before);
      await salsa.screenshot({ path: `${shots}/lonceng-pengingat.png` });
    });

    await test.step("pengaturan pengingat di profil", async () => {
      await hana.goto(`${BASE}/profil`);
      await hana.waitForLoadState("networkidle");
      await hana.getByText("Pengingat & notifikasi").waitFor();
      const status = await hana.getByTestId("push-status").innerText();
      check("status perangkat tampil", status.length > 10, status);
      await hana.getByRole("switch", { name: "Pengingat harian" }).uncheck();
      await hana.getByText("Pengingat harian dimatikan.").waitFor();
      check("matikan pengingat tersimpan", (await sql(`SELECT reminders FROM "User" WHERE id='e2e_hana'`))[0].reminders === false);
      await hana.screenshot({ path: `${shots}/profil-pengingat.png`, fullPage: true });
      await hana.getByRole("switch", { name: "Pengingat harian" }).check();
      await hana.getByText("Pengingat harian aktif.").waitFor();
    });
  } finally {
    push.server.close();
    await sql(`UPDATE "OfficeSetting" SET "workStart"='08:00', "lateAfter"='08:15', "workEnd"='16:00' WHERE id=1`);
    await sql(`UPDATE "User" SET reminders=true WHERE email LIKE '%@demo.local'`);
    await sql(`DELETE FROM "PushSubscription"`);
  }
});
