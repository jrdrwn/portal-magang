import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";
import type { Role } from "@/generated/prisma/enums";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId: string | null;
  teamName: string | null;
};

/** Baca sesi lalu muat user dari DB (satu kali per request). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      passwordChangedAt: true,
      teamId: true,
      team: { select: { name: true } },
    },
  });
  if (!user || !user.isActive) return null;
  // Tolak sesi yang dibuat sebelum password diganti/di-reset.
  if (user.passwordChangedAt && session.issuedAt < user.passwordChangedAt.getTime()) {
    return null;
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: user.teamId,
    teamName: user.team?.name ?? null,
  };
});

export const isAdmin = (role: Role) =>
  role === "SUPER_ADMIN" || role === "TEAM_ADMIN";

export function homePathFor(role: Role) {
  return isAdmin(role) ? "/admin" : "/dashboard";
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  // Lewat route yang menghapus cookie, agar tidak terjadi redirect berputar.
  if (!user) redirect("/auth/expired");
  return user;
}

export async function requireIntern(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "INTERN") redirect(homePathFor(user.role));
  return user;
}

/** Admin utama atau admin tim. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect(homePathFor(user.role));
  return user;
}

/** Hanya admin utama. Admin tim diarahkan ke ringkasan. */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") redirect(homePathFor(user.role));
  return user;
}

/**
 * Batas tim yang boleh dilihat admin.
 * - SUPER_ADMIN: null (semua tim)
 * - TEAM_ADMIN: id timnya; jika belum punya tim, id yang tidak ada agar hasil kosong.
 */
export function teamScope(user: CurrentUser): string | null {
  if (user.role === "SUPER_ADMIN") return null;
  return user.teamId ?? "__no_team__";
}
