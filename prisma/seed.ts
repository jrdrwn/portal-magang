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
      role: "SUPER_ADMIN",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  await db.officeSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  console.log(`Admin utama siap: ${email}`);

  if (process.env.SEED_DEMO !== "1") return;

  // Data demo (hanya jika SEED_DEMO=1): tim, admin tim, peserta, absensi, aktivitas, evaluasi.
  const hash = await bcrypt.hash("Demo#12345", 10);
  const teamDefs = [
    { name: "Web Development", description: "Membangun aplikasi web dengan Next.js dan TypeScript.", admin: "web" },
    { name: "Mobile Development", description: "Aplikasi Android/iOS dengan Flutter.", admin: "mobile" },
    { name: "UI/UX Design", description: "Riset pengguna, wireframe, dan desain antarmuka di Figma.", admin: "uiux" },
    { name: "Data Analyst", description: "Analisis data dan dashboard bisnis.", admin: null, isOpen: false },
  ];
  const teamIds: Record<string, string> = {};
  for (const t of teamDefs) {
    const team = await db.team.upsert({
      where: { name: t.name },
      update: {},
      create: { name: t.name, description: t.description, isOpen: t.isOpen ?? true },
    });
    teamIds[t.name] = team.id;
    if (t.admin) {
      await db.user.upsert({
        where: { email: `admin.${t.admin}@demo.local` },
        update: {},
        create: {
          email: `admin.${t.admin}@demo.local`,
          name: `Admin ${t.name}`,
          role: "TEAM_ADMIN",
          teamId: team.id,
          passwordHash: hash,
        },
      });
    }
  }

  const demo = [
    { name: "Nadia Putri", email: "nadia@demo.local", inst: "Universitas Indonesia", major: "Ilmu Komputer", div: "Web Development", type: "MANDIRI" as const },
    { name: "Raka Pratama", email: "raka@demo.local", inst: "ITB", major: "Informatika", div: "Mobile Development", type: "MAGANGHUB" as const },
    { name: "Salsa Amelia", email: "salsa@demo.local", inst: "SMK Telkom Jakarta", major: "RPL", div: "UI/UX Design", type: "MANDIRI" as const },
  ];

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

    const reg = await db.registration.create({
      data: {
        userId: user.id,
        teamId: teamIds[d.div],
        type: d.type,
        graduationYear: d.type === "MAGANGHUB" ? 2025 : null,
        startDate: dayStart(-45),
        endDate: dayStart(60),
        motivation: "Ingin belajar langsung dari praktik industri.",
        status: "APPROVED",
        reviewedAt: new Date(),
      },
    });

    const office = await db.officeSetting.findUniqueOrThrow({ where: { id: 1 } });
    // Evaluasi bulan lalu.
    const thisMonth = dayStart(0);
    const lastMonth = new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - 1, 1));
    await db.evaluation.create({
      data: {
        registrationId: reg.id,
        internId: user.id,
        month: lastMonth,
        discipline: 80 + i * 4,
        workQuality: 78 + i * 3,
        communication: 85 - i * 5,
        initiative: 75 + i * 5,
        teamwork: 88 - i * 2,
        notes: "Progres baik. Bulan depan fokus pada dokumentasi dan pengujian.",
      },
    });

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
  // Peserta yang periode magangnya sudah selesai (untuk mencoba survei & sertifikat).
  const dimas = await db.user.upsert({
    where: { email: "dimas@demo.local" },
    update: {},
    create: {
      email: "dimas@demo.local",
      name: "Dimas Saputra",
      passwordHash: hash,
      profile: { create: { institution: "Universitas Gadjah Mada", major: "Teknik Informatika" } },
    },
  });
  if (!(await db.registration.count({ where: { userId: dimas.id } }))) {
    const reg = await db.registration.create({
      data: {
        userId: dimas.id,
        teamId: teamIds["Web Development"],
        type: "MAGANGHUB",
        graduationYear: 2025,
        startDate: dayStart(-90),
        endDate: dayStart(-1),
        motivation: "Mengasah kemampuan full-stack di lingkungan kerja nyata.",
        status: "APPROVED",
        reviewedAt: new Date(),
      },
    });
    const thisMonth = dayStart(0);
    for (const back of [1, 2]) {
      await db.evaluation.create({
        data: {
          registrationId: reg.id,
          internId: dimas.id,
          month: new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - back, 1)),
          discipline: 90,
          workQuality: 88,
          communication: 86,
          initiative: 92,
          teamwork: 90,
          notes: "Konsisten dan proaktif.",
        },
      });
    }
  }

  console.log("Data demo dibuat. Password peserta (nadia/raka/salsa/dimas@demo.local) & admin tim (admin.web/mobile/uiux@demo.local): Demo#12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
