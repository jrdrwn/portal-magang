import { SignJWT, jwtVerify } from "jose";

// Dipakai bersama oleh proxy.ts dan server (tanpa import next/headers).
export const SESSION_COOKIE = "portal_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionRole = "SUPER_ADMIN" | "TEAM_ADMIN" | "INTERN";
export type SessionPayload = { userId: string; role: SessionRole };

export const isAdminRole = (role: SessionRole) =>
  role === "SUPER_ADMIN" || role === "TEAM_ADMIN";

function toRole(value: unknown): SessionRole {
  // "ADMIN" = token lama sebelum ada admin tim.
  if (value === "SUPER_ADMIN" || value === "ADMIN") return "SUPER_ADMIN";
  if (value === "TEAM_ADMIN") return "TEAM_ADMIN";
  return "INTERN";
}

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET harus diatur (minimal 32 karakter).");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: SessionPayload) {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export type VerifiedSession = SessionPayload & { issuedAt: number };

export async function verifyToken(
  token: string | undefined,
): Promise<VerifiedSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      role: toRole(payload.role),
      issuedAt: (payload.iat ?? 0) * 1000,
    };
  } catch {
    return null;
  }
}
