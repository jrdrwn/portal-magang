import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import pg from "pg";

/** Kosongkan database tes, terapkan migrasi, isi data demo. Menolak database yang bukan khusus tes. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL wajib diisi (database Postgres khusus tes).");
  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "postgres"].includes(u.hostname);
  if (!local && !u.pathname.includes("test")) {
    throw new Error(`Menolak menghapus database ${u.hostname}${u.pathname}: pakai host lokal atau nama database berisi "test".`);
  }

  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await c.end();
  rmSync(".e2e-storage", { recursive: true, force: true });

  const env = { ...process.env, DATABASE_URL: url, ADMIN_EMAIL: "admin@magang.local", ADMIN_PASSWORD: "Admin#12345", SEED_DEMO: "1" };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx prisma db seed", { env, stdio: "pipe" });

  // Tes tidak boleh bergantung pada hari dijalankan: semua hari dianggap hari kerja.
  const c2 = new pg.Client({ connectionString: url });
  await c2.connect();
  await c2.query(`UPDATE "OfficeSetting" SET "workDays"='0,1,2,3,4,5,6' WHERE id=1`);
  await c2.query(`DELETE FROM "Holiday" WHERE date = (now() AT TIME ZONE 'Asia/Jakarta')::date`);
  await c2.end();
}
