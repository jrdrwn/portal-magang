"use client";

import clsx from "clsx";
import { Camera, ImageUp, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MAX_SIDE = 640;
const QUALITY = 0.72;

/** Perkecil gambar ke JPEG (sisi terpanjang 640 px) agar unggahan ringan. */
async function toJpeg(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal memproses foto"))), "image/jpeg", QUALITY),
  );
}

/**
 * Ambil swafoto dari kamera depan. Jika kamera tidak bisa dibuka,
 * peserta bisa memilih/mengambil foto lewat pemilih file (di HP membuka kamera).
 */
export function SelfieCapture({ onChange, disabled }: { onChange: (photo: Blob | null) => void; disabled?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "live" | "captured" | "fallback">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  useEffect(() => () => stop(), []);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("fallback");
      return;
    }
    setState("starting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setState("live");
    } catch {
      stop();
      setError("Kamera tidak bisa dibuka. Izinkan akses kamera, atau unggah foto.");
      setState("fallback");
    }
  }

  async function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const blob = await toJpeg(v, v.videoWidth, v.videoHeight);
    stop();
    setPreview(URL.createObjectURL(blob));
    setState("captured");
    onChange(blob);
  }

  async function fromFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const blob = await toJpeg(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      setPreview(URL.createObjectURL(blob));
      setState("captured");
      onChange(blob);
    } catch {
      setError("File bukan gambar yang valid.");
    }
  }

  function retake() {
    onChange(null);
    setPreview(null);
    start();
  }

  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="mb-3 text-sm font-semibold">Swafoto</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl bg-black/30">
          <video
            ref={video}
            playsInline
            muted
            aria-label="Pratinjau kamera"
            className={clsx("size-full -scale-x-100 object-cover", state === "live" || state === "starting" ? "block" : "hidden")}
          />
          {state === "captured" && preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- pratinjau blob lokal
            <img src={preview} alt="Swafoto yang akan dikirim" className="size-full -scale-x-100 object-cover" />
          ) : null}
          {state === "idle" || state === "fallback" ? <Camera className="size-8 text-white/40" aria-hidden /> : null}
        </div>

        <div className="flex flex-col gap-2 text-sm">
          {state === "idle" ? (
            <button type="button" disabled={disabled} onClick={start} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 font-semibold hover:bg-white/25 disabled:opacity-50">
              <Camera className="size-4" aria-hidden /> Buka kamera
            </button>
          ) : null}
          {state === "live" ? (
            <button type="button" onClick={capture} className="inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 font-semibold text-ink hover:bg-lime/85">
              <Camera className="size-4" aria-hidden /> Ambil foto
            </button>
          ) : null}
          {state === "starting" ? <span className="text-white/70">Membuka kamera…</span> : null}
          {state === "captured" ? (
            <>
              <span className="font-medium text-lime">Foto siap dikirim</span>
              <button type="button" disabled={disabled} onClick={retake} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 font-semibold hover:bg-white/25 disabled:opacity-50">
                <RotateCcw className="size-4" aria-hidden /> Ulangi
              </button>
            </>
          ) : null}
          {state === "fallback" || state === "idle" ? (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 font-semibold text-white/80 hover:bg-white/10">
              <ImageUp className="size-4" aria-hidden /> Unggah foto
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="sr-only"
                disabled={disabled}
                onChange={(e) => fromFile(e.target.files?.[0])}
              />
            </label>
          ) : null}
          {error ? (
            <span role="alert" className="text-xs text-peach">
              {error}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
