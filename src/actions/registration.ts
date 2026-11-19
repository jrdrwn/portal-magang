"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireIntern } from "@/lib/auth";
import { notifyTeamAdmins } from "@/lib/notifications";
import {
  dateKey,
  daysBetweenInclusive,
  isValidDateKey,
  keyToDate,
  todayDate,
} from "@/lib/dates";
import {
  failure,
  str,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

const MAX_DURATION_DAYS = 366;

const schema = z.object({
  teamId: z.string().min(1, "Pilih tim"),
  type: z.enum(["MANDIRI", "MAGANGHUB"], "Pilih jenis magang"),
  graduationYear: z.string(),
  startDate: z.string().refine(isValidDateKey, "Tanggal mulai tidak valid"),
  endDate: z.string().refine(isValidDateKey, "Tanggal selesai tidak valid"),
  motivation: z
    .string()
    .min(10, "Ceritakan motivasi minimal 10 karakter")
    .max(1000, "Maksimal 1000 karakter"),
});

export async function createRegistration(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireIntern();

  const parsed = schema.safeParse({
    teamId: str(formData, "teamId"),
    type: str(formData, "type"),
    graduationYear: str(formData, "graduationYear"),
    startDate: str(formData, "startDate"),
    endDate: str(formData, "endDate"),
    motivation: str(formData, "motivation"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const start = keyToDate(parsed.data.startDate);
  const end = keyToDate(parsed.data.endDate);
  const fieldErrors: Record<string, string[]> = {};

  if (start < todayDate()) {
    fieldErrors.startDate = ["Tanggal mulai tidak boleh sebelum hari ini"];
  }
  if (end < start) {
    fieldErrors.endDate = ["Tanggal selesai tidak boleh sebelum tanggal mulai"];
  } else if (daysBetweenInclusive(start, end) > MAX_DURATION_DAYS) {
    fieldErrors.endDate = ["Durasi magang maksimal 12 bulan"];
  }

  // MagangHub khusus lulusan: tahun lulus wajib dan tidak di masa depan.
  let graduationYear: number | null = null;
  if (parsed.data.type === "MAGANGHUB") {
    const year = Number(parsed.data.graduationYear);
    const thisYear = Number(dateKey().slice(0, 4));
    if (!/^\d{4}$/.test(parsed.data.graduationYear) || year < thisYear - 10 || year > thisYear) {
      fieldErrors.graduationYear = [
        `Isi tahun lulus antara ${thisYear - 10} dan ${thisYear}`,
      ];
    } else {
      graduationYear = year;
    }
  }

  const team = await db.team.findUnique({ where: { id: parsed.data.teamId } });
  if (!team || !team.isOpen) {
    fieldErrors.teamId = ["Tim tidak tersedia atau sudah ditutup"];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Periksa kembali isian Anda.", fieldErrors };
  }

  // Tidak boleh tumpang tindih dengan pendaftaran lain yang masih berlaku.
  const overlap = await db.registration.findFirst({
    where: {
      userId: user.id,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap) {
    return failure(
      overlap.status === "PENDING"
        ? "Anda masih memiliki pendaftaran yang menunggu persetujuan pada rentang tanggal tersebut."
        : "Rentang tanggal tumpang tindih dengan pendaftaran Anda yang sudah disetujui.",
    );
  }

  const created = await db.registration.create({
    data: {
      userId: user.id,
      teamId: parsed.data.teamId,
      type: parsed.data.type,
      graduationYear,
      startDate: start,
      endDate: end,
      motivation: parsed.data.motivation,
    },
  });

  await notifyTeamAdmins(parsed.data.teamId, {
    type: "REGISTRATION_SUBMITTED",
    title: "Pendaftaran baru",
    body: `${user.name} mendaftar ke tim ${team!.name} (${parsed.data.type === "MAGANGHUB" ? "MagangHub" : "Mandiri"}).`,
    href: "/admin/pendaftaran",
    refId: created.id,
  });

  revalidatePath("/pendaftaran");
  revalidatePath("/dashboard");
  return success("Pendaftaran terkirim. Tunggu persetujuan admin.");
}

export async function cancelRegistration(id: string): Promise<ActionResult> {
  const user = await requireIntern();
  const res = await db.registration.deleteMany({
    where: { id, userId: user.id, status: "PENDING" },
  });
  if (res.count === 0) {
    return failure("Pendaftaran tidak ditemukan atau sudah diproses admin.");
  }
  revalidatePath("/pendaftaran");
  revalidatePath("/dashboard");
  return success("Pendaftaran dibatalkan.");
}
