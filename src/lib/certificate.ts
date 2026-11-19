import "server-only";
import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "./db";
import { averageScore, grade } from "./evaluation";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function verificationCode() {
  return Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export const SURVEY_QUESTIONS = [
  { key: "overall", label: "Secara keseluruhan, seberapa puas Anda dengan program magang ini?" },
  { key: "relevance", label: "Seberapa sesuai tugas magang dengan minat atau jurusan Anda?" },
  { key: "mentoring", label: "Bagaimana kualitas bimbingan dari admin tim / mentor?" },
  { key: "environment", label: "Bagaimana lingkungan dan fasilitas kerja selama magang?" },
  { key: "recommend", label: "Seberapa besar kemungkinan Anda merekomendasikan program ini ke teman?" },
] as const;
export type SurveyKey = (typeof SURVEY_QUESTIONS)[number]["key"];

/**
 * Terbitkan sertifikat untuk pendaftaran (idempoten).
 * Nomor: urut/MAGANG/bulan-romawi/tahun, urutan per tahun terbit.
 */
export async function issueCertificate(registrationId: string) {
  const existing = await db.certificate.findUnique({ where: { registrationId } });
  if (existing) return existing;

  const now = new Date();
  const year = now.getUTCFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.certificate.count({
      where: { issuedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
    });
    const seq = String(count + 1 + attempt).padStart(3, "0");
    try {
      return await db.certificate.create({
        data: {
          registrationId,
          number: `${seq}/MAGANG/${ROMAN[now.getUTCMonth()]}/${year}`,
          code: verificationCode(),
        },
      });
    } catch (err) {
      // Bentrok nomor/kode (penerbitan bersamaan): coba lagi dengan nomor berikutnya.
      const again = await db.certificate.findUnique({ where: { registrationId } });
      if (again) return again;
      if (attempt === 4) throw err;
    }
  }
  throw new Error("Gagal menerbitkan sertifikat");
}

/** Data lengkap untuk menampilkan sertifikat. */
export async function getCertificate(where: { id: string } | { code: string }) {
  const cert = await db.certificate.findUnique({
    where,
    include: {
      registration: {
        include: {
          user: { select: { id: true, name: true, profile: { select: { institution: true } } } },
          team: { select: { name: true } },
          evaluations: true,
        },
      },
    },
  });
  if (!cert) return null;
  const evals = cert.registration.evaluations;
  const avg = evals.length
    ? Math.round((evals.reduce((s, e) => s + averageScore(e), 0) / evals.length) * 10) / 10
    : null;
  return { ...cert, predicate: avg != null ? grade(avg) : null, average: avg };
}

/** Origin publik untuk tautan verifikasi (APP_URL bila diatur, jika tidak dari header request). */
export async function publicOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#15141f", light: "#00000000" } });
}
