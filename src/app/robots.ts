import type { MetadataRoute } from "next";

// Hanya halaman publik yang boleh diindeks mesin pencari.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/daftar", "/login"],
      disallow: ["/admin", "/dashboard", "/absensi", "/aktivitas", "/pendaftaran", "/evaluasi", "/profil", "/api", "/auth"],
    },
  };
}
