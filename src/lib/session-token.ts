import { SignJWT, jwtVerify } from "jose";

// Dipakai bersama oleh proxy.ts dan server (tanpa import next/headers).
export const SESSION_COOKIE = "portal_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = { userId: string; role: "ADMIN" | "INTERN" };

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

export async function verifyToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    const role = payload.role === "ADMIN" ? "ADMIN" : "INTERN";
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}
