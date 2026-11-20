"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireIntern } from "@/lib/auth";
import { notifyTeamAdmins } from "@/lib/notifications";
import { deleteFile, detectType, putFile, type FileType } from "@/lib/storage";
import { quotaUsed, teamAcceptingWhere } from "@/lib/queries";
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
const MAX_DOC_BYTES = 2 * 1024 * 1024;

type Upload = { kind: "CV" | "COVER_LETTER"; name: string; bytes: Uint8Array; type: FileType };

/** Validasi satu berkas: wajib/opsional, maks. 2 MB, PDF/JPG/PNG berdasarkan isi file. */
async function readUpload(formData: FormData, field: string, required: boolean) {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) {
    return required ? { error: "Berkas wajib diunggah" } : { upload: null };
  }
  if (file.size > MAX_DOC_BYTES) return { error: "Ukuran maksimal 2 MB" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectType(bytes);
  if (!type) return { error: "Format harus PDF, JPG, atau PNG" };
  return { upload: { name: file.name.slice(0, 120) || `berkas.${type.ext}`, bytes, type } };
}

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

  const team = await db.team.findFirst({ where: { id: parsed.data.teamId, ...teamAcceptingWhere() } });
  if (!team) {
    fieldErrors.teamId = ["Tim tidak tersedia atau pendaftarannya sudah ditutup"];
  } else if (team.quota != null && start <= end && (await quotaUsed(team.id, start, end)) >= team.quota) {
    fieldErrors.teamId = [`Kuota tim ${team.name} sudah penuh untuk periode ini`];
  }

  const uploads: Upload[] = [];
  const cv = await readUpload(formData, "cv", true);
  if ("error" in cv) fieldErrors.cv = [cv.error!];
  else if (cv.upload) uploads.push({ kind: "CV", ...cv.upload });
  const letter = await readUpload(formData, "coverLetter", parsed.data.type === "MANDIRI");
  if ("error" in letter) fieldErrors.coverLetter = [letter.error!];
  else if (letter.upload && parsed.data.type === "MANDIRI") uploads.push({ kind: "COVER_LETTER", ...letter.upload });

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

  const keys: string[] = [];
  let created;
  try {
    for (const u of uploads) keys.push(await putFile("documents", u.type, u.bytes));
    created = await db.registration.create({
      data: {
        userId: user.id,
        teamId: parsed.data.teamId,
        type: parsed.data.type,
        graduationYear,
        startDate: start,
        endDate: end,
        motivation: parsed.data.motivation,
        documents: {
          create: uploads.map((u, i) => ({
            kind: u.kind,
            fileKey: keys[i],
            fileName: u.name,
            mimeType: u.type.mime,
            size: u.bytes.byteLength,
          })),
        },
      },
    });
  } catch (err) {
    await Promise.all(keys.map(deleteFile));
    console.error("Gagal menyimpan pendaftaran", err);
    return failure("Pendaftaran gagal disimpan. Coba lagi.");
  }

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
  const docs = await db.document.findMany({
    where: { registration: { id, userId: user.id, status: "PENDING" } },
    select: { fileKey: true },
  });
  const res = await db.registration.deleteMany({
    where: { id, userId: user.id, status: "PENDING" },
  });
  if (res.count > 0) await Promise.all(docs.map((d) => deleteFile(d.fileKey)));
  if (res.count === 0) {
    return failure("Pendaftaran tidak ditemukan atau sudah diproses admin.");
  }
  revalidatePath("/pendaftaran");
  revalidatePath("/dashboard");
  return success("Pendaftaran dibatalkan.");
}
