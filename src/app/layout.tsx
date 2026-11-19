import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Portal Magang",
    template: "%s · Portal Magang",
  },
  description:
    "Portal peserta magang: pendaftaran, absensi berbasis lokasi, aktivitas harian, dan monitoring admin.",
};

export const viewport: Viewport = {
  themeColor: "#f2f1fa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
