import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isAdminRole, verifyToken } from "@/lib/session-token";

// Pengecekan awal (optimistic) berdasarkan cookie. Otorisasi sebenarnya
// tetap dilakukan di server (requireUser) dekat dengan data.
const INTERN_PATHS = [
  "/dashboard",
  "/absensi",
  "/aktivitas",
  "/pendaftaran",
  "/evaluasi",
  "/sertifikat",
  "/notifikasi",
  "/profil",
];
const AUTH_PATHS = ["/login", "/daftar"];

const matches = (pathname: string, bases: string[]) =>
  bases.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));

  if (matches(pathname, AUTH_PATHS)) {
    if (session) return redirectTo(isAdminRole(session.role) ? "/admin" : "/dashboard");
    return NextResponse.next();
  }

  const isAdminPath = matches(pathname, ["/admin"]);
  if (isAdminPath || matches(pathname, INTERN_PATHS)) {
    if (!session) return redirectTo("/login");
    const admin = isAdminRole(session.role);
    if (isAdminPath && !admin) return redirectTo("/dashboard");
    if (!isAdminPath && admin) return redirectTo("/admin");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/daftar",
    "/dashboard/:path*",
    "/absensi/:path*",
    "/aktivitas/:path*",
    "/pendaftaran/:path*",
    "/evaluasi/:path*",
    "/sertifikat/:path*",
    "/notifikasi/:path*",
    "/profil/:path*",
    "/admin/:path*",
  ],
};
