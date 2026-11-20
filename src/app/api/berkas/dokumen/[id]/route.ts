import { canViewIntern } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fileResponse, getFile } from "@/lib/storage";

/** Dokumen pendaftaran (CV, surat pengantar). */
export async function GET(req: Request, ctx: RouteContext<"/api/berkas/dokumen/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Tidak masuk", { status: 401 });
  const { id } = await ctx.params;

  const doc = await db.document.findUnique({
    where: { id },
    include: { registration: { select: { userId: true, teamId: true } } },
  });
  if (!doc) return new Response("Tidak ditemukan", { status: 404 });

  // Admin tim boleh melihat dokumen pendaftar timnya, termasuk yang belum disetujui.
  const allowed =
    (await canViewIntern(user, doc.registration.userId, { anyStatus: true })) &&
    (user.role !== "TEAM_ADMIN" || user.teamId === doc.registration.teamId || user.id === doc.registration.userId);
  if (!allowed) return new Response("Tidak ditemukan", { status: 404 });

  const body = await getFile(doc.fileKey);
  if (!body) return new Response("File tidak ada", { status: 404 });
  const inline = new URL(req.url).searchParams.get("unduh") !== "1";
  return fileResponse(body, { mime: doc.mimeType, fileName: doc.fileName, inline });
}
