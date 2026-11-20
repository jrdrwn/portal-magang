import { test } from "@playwright/test";
import { BASE, check, loggedIn, login, newSession, resetDemoAccounts, shotsDir } from "./helpers";

test("Navigasi berkelompok: sidebar & menu HP", async ({ browser }) => {
  await resetDemoAccounts();
  const shots = shotsDir("navigasi");
  const groupsOf = async (page: import("@playwright/test").Page) => {
    await page.locator("aside nav [role=group]").first().waitFor();
    return groupsOfNow(page);
  };
  const groupsOfNow = (page: import("@playwright/test").Page) =>
    page.locator("aside nav [role=group]").evaluateAll((els) =>
      els.map((el) => ({
        label: el.querySelector("p")?.textContent ?? "",
        items: [...el.querySelectorAll("a")].map((a) => a.textContent?.trim()),
      })),
    );

  const sup = (await newSession(browser)).page;
  await login(sup, "admin@magang.local", "Admin#12345");
  await loggedIn(sup);
  await sup.goto(`${BASE}/admin/libur`);
  const g = await groupsOf(sup);
  check("admin utama: grup sesuai", JSON.stringify(g.map((x) => x.label)) === JSON.stringify(["", "Peserta", "Kehadiran", "Penilaian", "Pengelolaan"]), JSON.stringify(g.map((x) => x.label)));
  check("admin utama: grup Pengelolaan lengkap", g.at(-1)?.items.join(",") === "Tim,Hari libur,Akun admin,Pengaturan,Log admin");
  check("menu aktif ditandai di grupnya", (await sup.locator('aside [role=group] a[aria-current="page"]').textContent()) === "Hari libur");
  check("grup punya label aksesibel", (await sup.getByRole("group", { name: "Pengelolaan" }).count()) === 1);
  await sup.screenshot({ path: `${shots}/sidebar-admin-utama.png` });

  const web = (await newSession(browser)).page;
  await login(web, "admin.web@demo.local");
  await loggedIn(web);
  const gw = await groupsOf(web);
  check("admin tim: Pengelolaan hanya Log admin", gw.at(-1)?.items.join(",") === "Log admin");

  const nadia = (await newSession(browser)).page;
  await login(nadia, "nadia@demo.local");
  await loggedIn(nadia);
  const gi = await groupsOf(nadia);
  check("peserta: grup Kehadiran/Magang/Akun", JSON.stringify(gi.map((x) => x.label)) === JSON.stringify(["", "Kehadiran", "Magang", "Akun"]));
  await nadia.screenshot({ path: `${shots}/sidebar-peserta.png` });

  // HP: tab utama + lembar Menu berkelompok.
  const m = (await newSession(browser, { width: 390, height: 844 })).page;
  await login(m, "admin@magang.local", "Admin#12345");
  await loggedIn(m);
  await m.waitForLoadState("networkidle");
  const bottom = m.locator("nav[aria-label='Menu utama']").last();
  const tabs = await bottom.locator("a, button").allTextContents();
  check("HP: 4 tab + Menu", tabs.length === 5 && tabs.at(-1) === "Menu", tabs.join(","));
  await bottom.getByRole("button", { name: "Menu" }).click();
  const sheet = m.getByRole("dialog", { name: "Semua menu" });
  await sheet.getByRole("group", { name: "Pengelolaan" }).waitFor();
  await m.screenshot({ path: `${shots}/hp-menu.png` });
  await sheet.getByRole("link", { name: "Hari libur" }).click();
  await m.waitForURL("**/admin/libur");
  check("HP: lembar menu tertutup setelah pindah halaman", !(await sheet.isVisible()));
  await bottom.getByRole("button", { name: "Menu" }).click();
  await m.keyboard.press("Escape");
  check("HP: Escape menutup lembar menu", !(await sheet.isVisible()));
});
