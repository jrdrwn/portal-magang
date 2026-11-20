import { test, type Page } from "@playwright/test";
import { BASE, check, loggedIn, login, newSession, resetDemoAccounts, shotsDir, sql } from "./helpers";

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1360, height: 900 };

/** Lebar dokumen tidak boleh melebihi layar (tidak ada scroll samping di level halaman). */
const pageWidth = (page: Page) =>
  page.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: window.innerWidth }));

async function rowInfo(page: Page) {
  return page.locator("main table").first().evaluate((table) => {
    const row = table.querySelector("tbody tr") as HTMLElement | null;
    const head = table.querySelector("thead") as HTMLElement | null;
    const firstCell = row?.querySelector("td") as HTMLElement | null;
    return {
      rowDisplay: row ? getComputedStyle(row).display : null,
      headHidden: head ? getComputedStyle(head).display === "none" : null,
      labels: [...(row?.querySelectorAll("td > span.md\\:hidden") ?? [])].map((s) => s.textContent),
      firstCellDisplay: firstCell ? getComputedStyle(firstCell).display : null,
    };
  });
}

test("Tabel responsif: kartu di HP, tabel di desktop", async ({ browser }) => {
  await resetDemoAccounts();
  const shots = shotsDir("tabel-responsif");
  const nadiaId = (await sql(`SELECT id FROM "User" WHERE email='nadia@demo.local'`))[0].id;
  await sql(
    `INSERT INTO "AuditLog" (id, "actorId", action, summary, "createdAt")
     SELECT 'e2e_log_responsif', id, 'settings.office', 'Uji tampilan tabel log di HP dengan keterangan yang cukup panjang agar terlihat cara teks dibungkus', now()
     FROM "User" WHERE email='admin@magang.local'
     ON CONFLICT (id) DO NOTHING`,
  );

  const pages: { name: string; url: string; who: "admin" | "intern"; waitFor: string; expectLabel: string }[] = [
    { name: "admin-peserta", url: "/admin/peserta", who: "admin", waitFor: "Nadia Putri", expectLabel: "Asal" },
    { name: "admin-absensi", url: "/admin/absensi", who: "admin", waitFor: "Monitor absensi", expectLabel: "Status" },
    { name: "admin-evaluasi", url: "/admin/evaluasi", who: "admin", waitFor: "Evaluasi bulanan", expectLabel: "Kehadiran" },
    { name: "admin-log", url: "/admin/log", who: "admin", waitFor: "Log admin", expectLabel: "Tindakan" },
    { name: "admin-libur", url: "/admin/libur?year=2026", who: "admin", waitFor: "Tahun Baru Masehi", expectLabel: "Jenis" },
    { name: "admin-detail-peserta", url: `/admin/peserta/${nadiaId}`, who: "admin", waitFor: "Riwayat absensi", expectLabel: "Status" },
    { name: "peserta-absensi", url: "/absensi", who: "intern", waitFor: "Riwayat absensi", expectLabel: "Masuk" },
  ];

  const sessions: Record<string, Record<string, Page>> = {};
  for (const [vpName, vp] of [["hp", MOBILE], ["desktop", DESKTOP]] as const) {
    const admin = (await newSession(browser, vp)).page;
    await login(admin, "admin@magang.local", "Admin#12345");
    await loggedIn(admin);
    const intern = (await newSession(browser, vp)).page;
    await login(intern, "nadia@demo.local");
    await loggedIn(intern);
    sessions[vpName] = { admin, intern };
  }

  for (const p of pages) {
    await test.step(p.name, async () => {
      const m = sessions.hp[p.who];
      await m.goto(`${BASE}${p.url}`);
      await m.locator("main").getByText(p.waitFor).first().waitFor();
      await m.locator("main tbody tr").first().waitFor();
      const w = await pageWidth(m);
      check(`${p.name} (HP): tidak melebar ke samping`, w.doc <= w.view, `${w.doc} > ${w.view}`);
      const info = await rowInfo(m);
      check(`${p.name} (HP): baris jadi kartu`, info.rowDisplay === "block" && info.headHidden === true, JSON.stringify(info));
      check(`${p.name} (HP): label kolom tampil`, info.labels.includes(p.expectLabel), info.labels.join(","));
      await m.screenshot({ path: `${shots}/${p.name}-hp.png`, fullPage: true });

      const d = sessions.desktop[p.who];
      await d.goto(`${BASE}${p.url}`);
      await d.locator("main").getByText(p.waitFor).first().waitFor();
      await d.locator("main tbody tr").first().waitFor();
      const dInfo = await rowInfo(d);
      check(`${p.name} (desktop): tetap tabel`, dInfo.rowDisplay === "table-row" && dInfo.headHidden === false, JSON.stringify(dInfo));
      const dw = await pageWidth(d);
      check(`${p.name} (desktop): tidak melebar`, dw.doc <= dw.view, `${dw.doc} > ${dw.view}`);
    });
  }
});
