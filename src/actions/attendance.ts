"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireIntern } from "@/lib/auth";
import { notifyTeamAdmins } from "@/lib/notifications";
import { minutesOfDay, parseClock, todayDate } from "@/lib/dates";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { getActiveRegistration, getOfficeSetting } from "@/lib/queries";
import {
  failure,
  str,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/absensi");
  revalidatePath("/aktivitas");
}

async function checkLocation(input: unknown) {
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Lokasi tidak valid. Aktifkan GPS lalu coba lagi.",
    };
  }
  const office = await getOfficeSetting();
  const distance = distanceMeters(
    parsed.data.lat,
    parsed.data.lng,
    office.latitude,
    office.longitude,
  );
  if (distance > office.radiusMeters) {
    return {
      ok: false as const,
      error: `Anda berada ${formatDistance(distance)} dari ${office.name}. Absen hanya bisa dalam radius ${office.radiusMeters} m.`,
    };
  }
  return { ok: true as const, office, distance, ...parsed.data };
}

export async function checkIn(input: {
  lat: number;
  lng: number;
}): Promise<ActionResult> {
  const user = await requireIntern();
  const today = todayDate();

  const registration = await getActiveRegistration(user.id, today);
  if (!registration) {
    return failure(
      "Anda belum memiliki pendaftaran magang aktif untuk hari ini.",
    );
  }

  const existing = await db.attendance.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
  if (existing) return failure("Anda sudah mencatat kehadiran hari ini.");

  const loc = await checkLocation(input);
  if (!loc.ok) return failure(loc.error);

  const late = minutesOfDay() > parseClock(loc.office.lateAfter);
  try {
    await db.attendance.create({
      data: {
        userId: user.id,
        date: today,
        status: late ? "LATE" : "PRESENT",
        checkInAt: new Date(),
        checkInLat: loc.lat,
        checkInLng: loc.lng,
        checkInDistance: loc.distance,
      },
    });
  } catch {
    // Unique (userId, date): klik ganda / dua tab.
    return failure("Anda sudah mencatat kehadiran hari ini.");
  }

  refresh();
  return success(
    late
      ? "Absen masuk tercatat (terlambat). Semangat!"
      : "Absen masuk tercatat. Selamat bekerja!",
  );
}

export async function checkOut(input: {
  lat: number;
  lng: number;
}): Promise<ActionResult> {
  const user = await requireIntern();
  const today = todayDate();

  const attendance = await db.attendance.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
  if (!attendance || !attendance.checkInAt) {
    return failure("Anda belum absen masuk hari ini.");
  }
  if (attendance.checkOutAt) return failure("Anda sudah absen pulang.");

  const loc = await checkLocation(input);
  if (!loc.ok) return failure(loc.error);

  const res = await db.attendance.updateMany({
    where: { id: attendance.id, checkOutAt: null },
    data: {
      checkOutAt: new Date(),
      checkOutLat: loc.lat,
      checkOutLng: loc.lng,
      checkOutDistance: loc.distance,
    },
  });
  if (res.count === 0) return failure("Anda sudah absen pulang.");

  refresh();
  return success("Absen pulang tercatat. Sampai jumpa besok!");
}

const absenceSchema = z.object({
  kind: z.enum(["PERMIT", "SICK"]),
  note: z
    .string()
    .min(5, "Alasan minimal 5 karakter")
    .max(500, "Alasan maksimal 500 karakter"),
});

/** Tidak bekerja hari ini (izin / sakit). Otomatis tercatat sebagai aktivitas "tidak bekerja". */
export async function submitAbsence(formData: FormData): Promise<ActionResult> {
  const user = await requireIntern();
  const today = todayDate();

  const parsed = absenceSchema.safeParse({
    kind: str(formData, "kind"),
    note: str(formData, "note"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const registration = await getActiveRegistration(user.id, today);
  if (!registration) {
    return failure(
      "Anda belum memiliki pendaftaran magang aktif untuk hari ini.",
    );
  }

  const existing = await db.attendance.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });
  if (existing) return failure("Anda sudah mencatat kehadiran hari ini.");

  const label = parsed.data.kind === "SICK" ? "Sakit" : "Izin";
  try {
    await db.attendance.create({
      data: {
        userId: user.id,
        date: today,
        status: parsed.data.kind,
        note: parsed.data.note,
        activities: {
          create: {
            userId: user.id,
            date: today,
            type: "NOT_WORK",
            title: label,
            description: parsed.data.note,
          },
        },
      },
    });
  } catch {
    return failure("Anda sudah mencatat kehadiran hari ini.");
  }

  await notifyTeamAdmins(registration.teamId, {
    type: "ABSENCE_REPORTED",
    title: `${user.name} ${label.toLowerCase()} hari ini`,
    body: parsed.data.note,
    href: "/admin/absensi",
  });

  refresh();
  return success(`${label} tercatat untuk hari ini.`);
}
