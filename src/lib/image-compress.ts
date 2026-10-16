"use client";

/**
 * Photos from phones can be 10MB or more. We accept originals up to 25MB, but shrink them in the browser
 * before uploading (max side, good quality), so uploads stay fast on slow connections and pages stay light.
 */
export interface ShrinkOptions {
  maxSide: number;
  quality: number;
  /** Force JPEG output (for opaque documents). Otherwise JPEG stays JPEG and PNG/WebP become WebP to keep transparency. */
  forceJpeg?: boolean;
}

const SHRINKABLE = ["image/jpeg", "image/png", "image/webp"];

async function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export async function shrinkImage(file: File, { maxSide, quality, forceJpeg }: ShrinkOptions): Promise<File> {
  if (!SHRINKABLE.includes(file.type) || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    // Already small enough in both dimensions and bytes: keep the original untouched.
    if (scale === 1 && file.size <= 1_200_000) {
      bitmap.close();
      return file;
    }
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    if (forceJpeg || file.type === "image/jpeg") {
      ctx.fillStyle = "#ffffff"; // JPEG has no transparency
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const wanted = forceJpeg || file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    let blob = await encode(canvas, wanted, quality);
    // Some browsers can't encode WebP and silently return PNG: fall back to JPEG.
    if (!blob || (blob.type !== wanted && wanted === "image/webp")) blob = await encode(canvas, "image/jpeg", quality);
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file; // unreadable by the canvas (e.g. unusual format): upload as is
  }
}