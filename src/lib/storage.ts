import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Penyimpanan file di disk lokal (folder `storage/`, bisa diganti lewat STORAGE_DIR).
 * Tidak cocok untuk hosting serverless (mis. Vercel) karena disk-nya tidak permanen:
 * ganti implementasi fungsi di file ini ke S3/R2/Vercel Blob sebelum deploy ke sana.
 */
const ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), process.env.STORAGE_DIR ?? "storage");

export type FileType = { mime: "application/pdf" | "image/jpeg" | "image/png"; ext: "pdf" | "jpg" | "png" };

const KEY_PATTERN = /^(documents|selfies)\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/;

/** Deteksi jenis file dari isi (magic bytes), bukan dari nama/ekstensi. */
export function detectType(bytes: Uint8Array): FileType | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" };
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  return null;
}

function resolveKey(key: string) {
  if (!KEY_PATTERN.test(key)) throw new Error("Kunci file tidak valid");
  return path.join(ROOT, key);
}

export async function putFile(prefix: "documents" | "selfies", type: FileType, bytes: Uint8Array) {
  const month = new Date().toISOString().slice(0, 7);
  const key = `${prefix}/${month}/${randomUUID()}.${type.ext}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { flag: "wx" });
  return key;
}

export async function getFile(key: string) {
  try {
    return await readFile(resolveKey(key));
  } catch {
    return null;
  }
}

export async function deleteFile(key: string) {
  try {
    await unlink(resolveKey(key));
  } catch {
    // Sudah tidak ada: abaikan.
  }
}

const MIME_BY_EXT: Record<string, FileType["mime"]> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
};

export function mimeOfKey(key: string) {
  return MIME_BY_EXT[key.split(".").pop() ?? ""] ?? "application/octet-stream";
}

/** Response file dengan header aman (tanpa sniffing, tanpa cache publik). */
export function fileResponse(body: Uint8Array, opts: { mime: string; fileName?: string; inline?: boolean }) {
  const name = (opts.fileName ?? "berkas").replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": opts.mime,
      "Content-Disposition": `${opts.inline ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
