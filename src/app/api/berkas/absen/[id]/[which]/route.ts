import { canViewIntern } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fileResponse, getFile, mimeOfKey } from "@/lib/storage";

/** Swafoto absen masuk/pulang. */
export async function GET(_req: Request, ctx: RouteContext<"/api/berkas/absen/[id]/[which]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Tidak masuk", { status: 401 });
  const { id, which } = await ctx.params;
  if (which !== "masuk" && which !== "pulang") return new Response("Tidak ditemukan", { status: 404 });

  const att = await db.attendance.findUnique({
    where: { id },
    select: { userId: true, date: true, checkInPhotoKey: true, checkOutPhotoKey: true },
  });
  const key = which === "masuk" ? att?.checkInPhotoKey : att?.checkOutPhotoKey;
  if (!att || !key || !(await canViewIntern(user, att.userId))) {
    return new Response("Tidak ditemukan", { status: 404 });
  }
  const body = await getFile(key);
  if (!body) return new Response("File tidak ada", { status: 404 });
  return fileResponse(body, {
    mime: mimeOfKey(key),
    fileName: `swafoto-${which}-${att.date.toISOString().slice(0, 10)}.${key.split(".").pop()}`,
    inline: true,
  });
}
