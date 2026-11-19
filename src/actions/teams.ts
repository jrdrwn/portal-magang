"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import {
  failure,
  str,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

const teamSchema = z.object({
  name: z.string().min(2, "Nama tim minimal 2 karakter").max(60),
  description: z.string().max(300, "Deskripsi maksimal 300 karakter"),
  isOpen: z.boolean(),
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
  });
}

async function nameTaken(name: string, exceptId?: string) {
  const found = await db.team.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, id: { not: exceptId } },
  });
  return Boolean(found);
}

export async function createTeam(formData: FormData): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = parse(formData);
  if (!parsed.success) return validationFailure(parsed.error);
  if (await nameTaken(parsed.data.name)) {
    return {
      ok: false,
      error: "Periksa kembali isian Anda.",
      fieldErrors: { name: ["Nama tim sudah dipakai"] },
    };
  }
  await db.team.create({
    data: { ...parsed.data, description: parsed.data.description || null },
  });
  refresh();
  return success(`Tim "${parsed.data.name}" dibuat.`);
}

export async function updateTeam(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireSuperAdmin();
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
  refresh();
  return success("Tim diperbarui.");
}

export async function setTeamOpen(
  id: string,
  isOpen: boolean,
): Promise<ActionResult> {
  await requireSuperAdmin();
  const res = await db.team.updateMany({ where: { id }, data: { isOpen } });
  if (res.count === 0) return failure("Tim tidak ditemukan.");
  refresh();
  return success(isOpen ? "Pendaftaran tim dibuka." : "Pendaftaran tim ditutup.");
}

export async function deleteTeam(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const count = await db.registration.count({ where: { teamId: id } });
  if (count > 0) {
    return failure(
      "Tim sudah punya pendaftaran sehingga tidak bisa dihapus. Tutup pendaftarannya saja.",
    );
  }
  // Admin tim yang terhubung otomatis dilepas (onDelete: SetNull).
  const res = await db.team.deleteMany({ where: { id } });
  if (res.count === 0) return failure("Tim tidak ditemukan.");
  refresh();
  return success("Tim dihapus.");
}
