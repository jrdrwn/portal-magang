import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

// Sesi tidak berlaku lagi (akun nonaktif / password diganti): hapus cookie lalu ke halaman login.
// Tanpa ini, proxy melihat JWT yang masih valid dan mengalihkan bolak-balik antara /login dan /dashboard.
// Penanda singkat di cookie memastikan pesan "sesi berakhir" tetap tampil walau ada redirect lain yang mendahului.
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login?expired=1", request.url));
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.set("portal_expired", "1", { maxAge: 60, path: "/", sameSite: "lax" });
  return res;
}
