"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth";
import { WEEKDAYS } from "@/lib/calendar";
import { db } from "@/lib/db";
import { formatDate, isValidDateKey, keyToDate } from "@/lib/dates";
import { failure, str, success, validationFailure, type ActionResult } from "@/lib/action-result";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/absensi");
  revalidatePath("/dashboard");
}

const holidaySchema = z.object({
  date: z.string().refine(isValidDateKey, "Tanggal tidak valid"),
  name: z.string().min(3, "Nama libur minimal 3 karakter").max(100),
  kind: z.enum(["NATIONAL", "JOINT_LEAVE", "OFFICE"], "Pilih jenis libur"),
});

export async function createHoliday(formData: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const parsed = holidaySchema.safeParse({
    date: str(formData, "date"),
    name: str(formData, "name"),
    kind: str(formData, "kind"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const date = keyToDate(parsed.data.date);
  if (await db.holiday.findUnique({ where: { date } })) {
    return {
      ok: false,
      error: "Periksa kembali isian Anda.",
      fieldErrors: { date: ["Tanggal ini sudah terdaftar sebagai hari libur"] },
    };
  }
  const h = await db.holiday.create({ data: { ...parsed.data, date } });
  await audit(admin, "holiday.create", { summary: `${formatDate(date)} · ${h.name}`, targetType: "Holiday", targetId: h.id });
  refresh();
  return success(`Libur ${formatDate(date)} ditambahkan.`);
}

export async function deleteHoliday(id: string): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const h = await db.holiday.findUnique({ where: { id } });
  if (!h) return failure("Hari libur tidak ditemukan.");
  await db.holiday.delete({ where: { id } });
  await audit(admin, "holiday.delete", { summary: `${formatDate(h.date)} · ${h.name}`, targetType: "Holiday", targetId: id });
  refresh();
  return success("Hari libur dihapus.");
}

export async function updateWorkDays(formData: FormData): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const allowed = new Set<number>(WEEKDAYS.map((d) => d.value));
  const days = formData
    .getAll("workDays")
    .map((v) => Number(v))
    .filter((n) => allowed.has(n));
  if (days.length === 0) {
    return failure("Pilih minimal satu hari kerja.");
  }
  const value = [...new Set(days)].sort().join(",");
  await db.officeSetting.upsert({ where: { id: 1 }, update: { workDays: value }, create: { id: 1, workDays: value } });
  const labels = WEEKDAYS.filter((d) => days.includes(d.value)).map((d) => d.label).join(", ");
  await audit(admin, "settings.office", { summary: `Hari kerja: ${labels}` });
  refresh();
  return success("Hari kerja disimpan.");
}
