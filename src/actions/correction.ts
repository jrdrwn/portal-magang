"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin, teamScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, isValidClock, isValidDateKey, keyToDate, parseClock, todayDate } from "@/lib/dates";
import { attendanceLabel } from "@/lib/labels";
import { notify } from "@/lib/notifications";
import { failure, str, validationFailure, type ActionResult } from "@/lib/action-result";

const clock = z.string().refine((v) => v === "" || isValidClock(v), "Format jam HH:mm");

const schema = z
  .object({
    status: z.enum(["PRESENT", "LATE", "PERMIT", "SICK", "ABSENT"], "Pilih status"),
    checkIn: clock,
    checkOut: clock,
    note: z.string().max(500, "Maksimal 500 karakter"),
    reason: z.string().min(5, "Alasan koreksi minimal 5 karakter").max(500, "Maksimal 500 karakter"),
  })
  .superRefine((v, ctx) => {
    if (v.status === "PRESENT" || v.status === "LATE") {
      if (!v.checkIn) ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Jam masuk wajib diisi" });
      if (v.checkIn && v.checkOut && parseClock(v.checkOut) <= parseClock(v.checkIn)) {
        ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Jam pulang harus setelah jam masuk" });
      }
    }
    if ((v.status === "PERMIT" || v.status === "SICK") && v.note.length < 5) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Isi keterangan izin/sakit (min. 5 karakter)" });
    }
  });

/** Jam WIB pada tanggal tertentu -> Date (UTC). */
const at = (dateKey: string, hhmm: string) => new Date(`${dateKey}T${hhmm}:00+07:00`);

const STATUS_TEXT = { ...Object.fromEntries(Object.entries(attendanceLabel).map(([k, v]) => [k, v.label])), ABSENT: "Alpa" } as Record<string, string>;

export async function correctAttendance(
  internId: string,
  dateKey: string,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const scope = teamScope(admin);
  if (!isValidDateKey(dateKey)) return failure("Tanggal tidak valid.");
  const date = keyToDate(dateKey);
  if (date > todayDate()) return failure("Tidak bisa mengoreksi tanggal yang belum terjadi.");

  // Tanggal harus dalam periode magang yang disetujui (dan di tim admin, untuk admin tim).
  const reg = await db.registration.findFirst({
    where: {
      userId: internId,
      status: "APPROVED",
      startDate: { lte: date },
      endDate: { gte: date },
      ...(scope ? { teamId: scope } : {}),
    },
    include: { user: { select: { name: true } } },
  });
  if (!reg) return failure("Tanggal ini di luar periode magang peserta di tim Anda.");

  const parsed = schema.safeParse({
    status: str(formData, "status"),
    checkIn: str(formData, "checkIn"),
    checkOut: str(formData, "checkOut"),
    note: str(formData, "note"),
    reason: str(formData, "reason"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const d = parsed.data;

  const existing = await db.attendance.findUnique({
    where: { userId_date: { userId: internId, date } },
    include: { activities: { select: { id: true, type: true } } },
  });
  const before = existing ? existing.status : "ABSENT";

  if (d.status === "ABSENT") {
    if (!existing) return failure("Hari ini sudah tercatat alpa.");
    if (existing.activities.some((a) => a.type === "WORK")) {
      return failure("Peserta sudah mencatat aktivitas kerja pada hari ini, jadi tidak bisa diubah menjadi alpa.");
    }
    await db.attendance.delete({ where: { id: existing.id } });
  } else {
    const working = d.status === "PRESENT" || d.status === "LATE";
    const data = {
      status: d.status,
      checkInAt: working ? at(dateKey, d.checkIn) : null,
      checkOutAt: working && d.checkOut ? at(dateKey, d.checkOut) : null,
      note: working ? existing?.note ?? null : d.note,
      correctedById: admin.id,
      correctedAt: new Date(),
      correctionReason: d.reason,
    };
    await db.$transaction(async (tx) => {
      const att = existing
        ? await tx.attendance.update({ where: { id: existing.id }, data })
        : await tx.attendance.create({ data: { ...data, userId: internId, date } });
      // Aktivitas "tidak bekerja" mengikuti status izin/sakit.
      await tx.activity.deleteMany({ where: { attendanceId: att.id, type: "NOT_WORK" } });
      if (!working) {
        await tx.activity.create({
          data: {
            userId: internId,
            attendanceId: att.id,
            date,
            type: "NOT_WORK",
            title: d.status === "SICK" ? "Sakit" : "Izin",
            description: d.note,
          },
        });
      }
    });
  }

  const summary = `${reg.user.name} · ${formatDate(date)} · ${STATUS_TEXT[before]} → ${STATUS_TEXT[d.status]} · alasan: ${d.reason}`;
  await audit(admin, d.status === "ABSENT" ? "attendance.delete" : "attendance.correct", {
    summary,
    targetType: "User",
    targetId: internId,
    teamId: reg.teamId,
    meta: { date: dateKey, before, after: d.status, checkIn: d.checkIn, checkOut: d.checkOut },
  });
  await notify([internId], {
    type: "ATTENDANCE_CORRECTED",
    title: `Absensi ${formatDate(date)} dikoreksi`,
    body: `Status: ${STATUS_TEXT[before]} → ${STATUS_TEXT[d.status]}. Alasan: ${d.reason}`,
    href: "/absensi",
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/absensi");
  revalidatePath("/dashboard");
  redirect(`/admin/peserta/${internId}?koreksi=${dateKey}`);
}
