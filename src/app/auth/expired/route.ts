import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

// Sesi tidak berlaku lagi (akun nonaktif / password diganti): hapus cookie lalu ke halaman login.
// Tanpa ini, proxy melihat JWT yang masih valid dan mengalihkan bolak-balik antara /login dan /dashboard.
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login?expired=1", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
