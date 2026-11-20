import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Koneksi database.
 *
 * Neon (dan Postgres di balik pooler) memutus koneksi yang menganggur, misalnya saat compute
 * auto-suspend lalu bangun lagi. Koneksi mati yang masih tersimpan di pool membuat query gagal
 * dengan "Connection terminated unexpectedly". Karena itu:
 * - koneksi menganggur dibuang cepat dan diberi umur maksimal, dan
 * - query BACA dicoba ulang bila gagal karena koneksi putus. Query tulis tidak diulang
 *   agar tidak tersimpan dua kali bila ternyata sempat berhasil di server.
 */

const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const CONNECTION_ERROR =
  /Connection terminated|connection timeout|ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|socket hang up|Server has closed the connection|Can't reach database|terminating connection|57P0[123]|08000|08003|08006|P1001|P1017/i;

export function isConnectionError(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    const { message, code, cause } = e as { message?: string; code?: string; cause?: unknown };
    if (CONNECTION_ERROR.test(`${code ?? ""} ${message ?? ""}`)) return true;
    e = cause;
  }
  return false;
}

const MAX_RETRIES = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createBase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diatur. Salin .env.example ke .env.");
  }
  const adapter = new PrismaPg(
    {
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 5_000, // lebih cepat dari batas idle pooler/Neon
      maxLifetimeSeconds: 300, // ganti koneksi berkala
      connectionTimeoutMillis: 15_000, // beri waktu Neon bangun dari suspend
      keepAlive: true,
    },
    {
      // Koneksi menganggur yang diputus server: cukup dicatat, pool akan membuat yang baru.
      onPoolError: (err) => console.warn("[db] koneksi menganggur terputus:", err.message),
      onConnectionError: (err) => console.warn("[db] koneksi terputus:", err.message),
    },
  );
  return new PrismaClient({ adapter });
}

function withRetry(base: PrismaClient) {
  return base.$extends({
    name: "retry-on-connection-error",
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (!READ_OPERATIONS.has(operation)) return query(args);
          for (let attempt = 0; ; attempt++) {
            try {
              return await query(args);
            } catch (err) {
              if (attempt >= MAX_RETRIES || !isConnectionError(err)) throw err;
              await sleep(100 * 2 ** attempt);
            }
          }
        },
      },
    },
  });
}

export type Db = ReturnType<typeof withRetry>;

// Di dev, klien disimpan di globalThis agar hot reload tidak membuat pool baru.
// Setelah `prisma generate` kelas PrismaClient berganti; klien lama (tanpa model baru) dibuang.
const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient; prismaDb?: Db };

function getDb(): Db {
  const cached = globalForPrisma.prismaBase;
  if (cached instanceof PrismaClient && globalForPrisma.prismaDb) return globalForPrisma.prismaDb;
  if (cached) void cached.$disconnect().catch(() => {});
  const base = createBase();
  const db = withRetry(base);
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaBase = base;
    globalForPrisma.prismaDb = db;
  }
  return db;
}

export const db = getDb();
