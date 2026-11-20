import type { MetadataRoute } from "next";

// Agar portal bisa di-"install" di HP (praktis untuk absen harian).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal Magang",
    short_name: "Magang",
    description: "Absensi lokasi, aktivitas harian, dan evaluasi peserta magang.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f2f1fa",
    theme_color: "#5841f0",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
