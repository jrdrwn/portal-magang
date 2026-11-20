"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { formatDate, isValidDateKey, keyToDate } from "@/lib/dates";
import {
  failure,
  str,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

const optionalDate = z
  .string()
  .refine((v) => v === "" || isValidDateKey(v), "Tanggal tidak valid")
  .transform((v) => (v ? keyToDate(v) : null));

const teamSchema = z
  .object({
    name: z.string().min(2, "Nama tim minimal 2 karakter").max(60),
    description: z.string().max(300, "Deskripsi maksimal 300 karakter"),
    isOpen: z.boolean(),
    quota: z
      .string()
      .refine((v) => v === "" || /^\d+$/.test(v), "Kuota harus bilangan bulat")
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v == null || (v >= 1 && v <= 500), "Kuota 1–500, atau kosongkan untuk tanpa batas"),
    regOpensAt: optionalDate,
    regClosesAt: optionalDate,
  })
  .refine((v) => !v.regOpensAt || !v.regClosesAt || v.regClosesAt >= v.regOpensAt, {
    path: ["regClosesAt"],
    message: "Tanggal tutup tidak boleh sebelum tanggal buka",
  });

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath("/daftar");
  revalidatePath("/pendaftaran");
}

function parse(formData: FormData) {
  return teamSchema.safeParse({
    name: str(formData, "name"),
    description: str(formData, "description"),
    isOpen: formData.get("isOpen") === "on",
    quota: str(formData, "quota"),
    regOpensAt: str(formData, "regOpensAt"),
    regClosesAt: str(formData, "regClosesAt"),
  });
}

async function nameTaken(name: string, exceptId?: string) {
  const found = await db.team.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, id: { not: exceptId } },
  });
  return Boolean(found);
}

export async function createTeam(formData: FormData): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const parsed = parse(formData);
  if (!parsed.success) return validationFailure(parsed.error);
  if (await nameTaken(parsed.data.name)) {
    return {
      ok: false,
      error: "Periksa kembali isian Anda.",
      fieldErrors: { name: ["Nama tim sudah dipakai"] },
    };
  }
  const created = await db.team.create({
    data: { ...parsed.data, description: parsed.data.description || null },
  });
  await audit(me, "team.create", { summary: parsed.data.name, targetType: "Team", targetId: created.id, teamId: created.id });
  refresh();
  return success(`Tim "${parsed.data.name}" dibuat.`);
}

export async function updateTeam(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const parsed = parse(formData);
  if (!parsed.success) return validationFailure(parsed.error);
  if (await nameTaken(parsed.data.name, id)) {
    return {
      ok: false,
      error: "Periksa kembali isian Anda.",
      fieldErrors: { name: ["Nama tim sudah dipakai"] },
    };
  }
  const res = await db.team.updateMany({
    where: { id },
    data: { ...parsed.data, description: parsed.data.description || null },
  });
  if (res.count === 0) return failure("Tim tidak ditemukan.");
  await audit(me, "team.update", {
    summary: `${parsed.data.name} · kuota ${parsed.data.quota ?? "tanpa batas"} · jadwal ${parsed.data.regOpensAt ? formatDate(parsed.data.regOpensAt) : "–"} s.d. ${parsed.data.regClosesAt ? formatDate(parsed.data.regClosesAt) : "–"}`,
    targetType: "Team",
    targetId: id,
    teamId: id,
  });
  refresh();
  return success("Tim diperbarui.");
}

export async function setTeamOpen(
  id: string,
  isOpen: boolean,
): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const res = await db.team.updateMany({ where: { id }, data: { isOpen } });
  if (res.count === 0) return failure("Tim tidak ditemukan.");
  const t = await db.team.findUnique({ where: { id }, select: { name: true } });
  await audit(me, isOpen ? "team.open" : "team.close", { summary: t?.name ?? id, targetType: "Team", targetId: id, teamId: id });
  refresh();
  return success(isOpen ? "Pendaftaran tim dibuka." : "Pendaftaran tim ditutup.");
}

export async function deleteTeam(id: string): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const before = await db.team.findUnique({ where: { id }, select: { name: true } });
  const count = await db.registration.count({ where: { teamId: id } });
  if (count > 0) {
    return failure(
      "Tim sudah punya pendaftaran sehingga tidak bisa dihapus. Tutup pendaftarannya saja.",
    );
  }
  // Admin tim yang terhubung otomatis dilepas (onDelete: SetNull).
  const res = await db.team.deleteMany({ where: { id } });
  if (res.count === 0) return failure("Tim tidak ditemukan.");
  await audit(me, "team.delete", { summary: before?.name ?? id, targetType: "Team", targetId: id });
  refresh();
  return success("Tim dihapus.");
}
