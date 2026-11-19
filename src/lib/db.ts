import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diatur. Salin .env.example ke .env.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Di dev, instance disimpan di globalThis agar hot reload tidak membuat koneksi baru.
// Setelah `prisma generate`, kelas PrismaClient berganti; instance lama (tanpa model baru)
// tidak lagi `instanceof` kelas ini, jadi dibuang dan dibuat ulang.
function getClient() {
  const cached = globalForPrisma.prisma;
  if (cached instanceof PrismaClient) return cached;
  if (cached) void (cached as { $disconnect?: () => Promise<void> }).$disconnect?.();
  return createClient();
}

export const db = getClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
