import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DAY = 86_400_000;
const dayStart = (offset: number) => {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
  return new Date(new Date(`${key}T00:00:00.000Z`).getTime() + offset * DAY);
};

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@magang.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD belum diatur di .env");

  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Admin Portal",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  await db.officeSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  console.log(`Admin siap: ${email}`);

  if (process.env.SEED_DEMO !== "1") return;

  // Data demo (hanya jika SEED_DEMO=1): peserta, pendaftaran, absensi, aktivitas.
  const demo = [
    { name: "Nadia Putri", email: "nadia@demo.local", inst: "Universitas Indonesia", major: "Ilmu Komputer", div: "Web Development" },
    { name: "Raka Pratama", email: "raka@demo.local", inst: "ITB", major: "Informatika", div: "Mobile Development" },
    { name: "Salsa Amelia", email: "salsa@demo.local", inst: "SMK Telkom Jakarta", major: "RPL", div: "UI/UX Design" },
  ];
  const hash = await bcrypt.hash("Demo#12345", 10);

  for (const [i, d] of demo.entries()) {
    const user = await db.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email,
        name: d.name,
        passwordHash: hash,
        profile: { create: { institution: d.inst, major: d.major, phone: "081234567890" } },
      },
    });
    if (await db.registration.count({ where: { userId: user.id } })) continue;

    await db.registration.create({
      data: {
        userId: user.id,
        division: d.div,
        startDate: dayStart(-14),
        endDate: dayStart(60),
        motivation: "Ingin belajar langsung dari praktik industri.",
        status: "APPROVED",
        reviewedAt: new Date(),
      },
    });

    const office = await db.officeSetting.findUniqueOrThrow({ where: { id: 1 } });
    for (let back = 14; back >= 0; back--) {
      const date = dayStart(-back);
      const dow = date.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      if (back === 0 && i === 2) continue; // satu peserta belum absen hari ini

      const permit = (back + i) % 9 === 0;
      const late = !permit && (back + i) % 5 === 0;
      const at = (h: number, m: number) =>
        new Date(date.getTime() + ((h - 7) * 60 + m) * 60_000);

      const att = await db.attendance.create({
        data: permit
          ? { userId: user.id, date, status: "PERMIT", note: "Keperluan keluarga" }
          : {
              userId: user.id,
              date,
              status: late ? "LATE" : "PRESENT",
              checkInAt: at(late ? 8 : 7, late ? 40 : 55),
              checkInLat: office.latitude + 0.0002,
              checkInLng: office.longitude + 0.0002,
              checkInDistance: 30,
              checkOutAt: back === 0 ? null : at(16, 5),
              checkOutLat: office.latitude + 0.0002,
              checkOutLng: office.longitude + 0.0002,
              checkOutDistance: 30,
            },
      });
      await db.activity.create({
        data: permit
          ? { userId: user.id, attendanceId: att.id, date, type: "NOT_WORK", title: "Izin", description: "Keperluan keluarga" }
          : { userId: user.id, attendanceId: att.id, date, type: "WORK", title: `Mengerjakan modul ${d.div}`, description: "Implementasi fitur sesuai arahan mentor." },
      });
    }
  }
  console.log("Data demo dibuat (password peserta: Demo#12345)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
