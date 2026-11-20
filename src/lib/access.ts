import "server-only";
import { db } from "./db";
import type { CurrentUser } from "./auth";

/**
 * Boleh melihat data pribadi peserta (foto absen, dokumen, laporan)?
 * - pemilik akun
 * - admin utama
 * - admin tim, jika peserta punya pendaftaran di timnya
 *   (`anyStatus` = termasuk pendaftaran yang masih menunggu, untuk meninjau dokumen)
 */
export async function canViewIntern(
  user: CurrentUser,
  internId: string,
  opts: { anyStatus?: boolean } = {},
) {
  if (user.id === internId || user.role === "SUPER_ADMIN") return true;
  if (user.role !== "TEAM_ADMIN" || !user.teamId) return false;
  const reg = await db.registration.findFirst({
    where: {
      userId: internId,
      teamId: user.teamId,
      ...(opts.anyStatus ? {} : { status: "APPROVED" as const }),
    },
    select: { id: true },
  });
  return Boolean(reg);
}
