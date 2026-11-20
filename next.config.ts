import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolokasi & kamera hanya untuk situs ini (absensi lokasi + swafoto); fitur lain dimatikan.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // CSP minimal yang tidak mengganggu script inline Next.js.
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // Unggah dokumen pendaftaran (2 × maks. 2 MB) dan swafoto absen.
    serverActions: { bodySizeLimit: "5mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
