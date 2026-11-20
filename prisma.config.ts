import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Kosong saat `npm install` tanpa .env: `prisma generate` tetap jalan; perintah migrate akan meminta URL.
    url: process.env.DATABASE_URL ?? "",
  },
});
