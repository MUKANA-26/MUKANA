export const MB = 1024 * 1024;

export type FileKind = "cv" | "placement_letter" | "avatar" | "cover" | "company_logo" | "verification_doc" | "cv_builder" | "post_media";
export type BucketId = "cvs" | "placement-letters" | "avatars" | "company-logos" | "verification-docs" | "post-media";

/** Largest original image we accept anywhere (it is shrunk in the browser before upload). */
export const IMAGE_MAX = 25 * MB;
export const POST_IMAGE_MAX = IMAGE_MAX;
/** PDFs keep their own, smaller limit. */
export const PDF_MAX = 5 * MB;
export const POST_VIDEO_MAX = 30 * MB;

export interface FileRule {
  bucket: BucketId;
  /** Owner folder is the user id, or the company id for company-owned buckets. */
  folder: "user" | "company";
  mimes: string[];
  extensions: string[];
  maxBytes: number;
  label: string;
}

export const FILE_RULES: Record<FileKind, FileRule> = {
  cv: { bucket: "cvs", folder: "user", mimes: ["application/pdf"], extensions: ["pdf"], maxBytes: 5 * MB, label: "CV (PDF, max 5MB)" },
  cv_builder: { bucket: "cvs", folder: "user", mimes: ["application/pdf"], extensions: ["pdf"], maxBytes: 5 * MB, label: "Generated CV" },
  placement_letter: {
    bucket: "placement-letters",
    folder: "user",
    mimes: ["application/pdf"],
    extensions: ["pdf"],
    maxBytes: 5 * MB,
    label: "Placement letter (PDF, max 5MB)",
  },
  avatar: {
    bucket: "avatars",
    folder: "user",
    mimes: ["image/jpeg", "image/png", "image/webp"],
    extensions: ["jpg", "jpeg", "png", "webp"],
    maxBytes: IMAGE_MAX,
    label: "Photo (JPG, PNG or WebP, up to 25MB)",
  },
  cover: {
    bucket: "avatars",
    folder: "user",
    mimes: ["image/jpeg", "image/png", "image/webp"],
    extensions: ["jpg", "jpeg", "png", "webp"],
    maxBytes: IMAGE_MAX,
    label: "Cover photo (JPG, PNG or WebP, up to 25MB)",
  },
  company_logo: {
    bucket: "company-logos",
    folder: "company",
    mimes: ["image/jpeg", "image/png", "image/webp"],
    extensions: ["jpg", "jpeg", "png", "webp"],
    maxBytes: IMAGE_MAX,
    label: "Logo (JPG, PNG or WebP, up to 25MB)",
  },
  post_media: {
    bucket: "post-media",
    folder: "user",
    mimes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"],
    extensions: ["jpg", "jpeg", "png", "webp", "mp4", "webm", "mov"],
    maxBytes: 30 * MB,
    label: "Photo (up to 25MB) or video (up to 30MB)",
  },
  verification_doc: {
    bucket: "verification-docs",
    folder: "company",
    mimes: ["application/pdf", "image/jpeg", "image/png"],
    extensions: ["pdf", "jpg", "jpeg", "png"],
    maxBytes: IMAGE_MAX,
    label: "Document (PDF up to 5MB, or a JPG/PNG photo up to 25MB)",
  },
};

/** Detects the real file type from its first bytes (never trust the extension or declared MIME). */
export function sniffMime(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp") return ascii(8, 10) === "qt" ? "video/quicktime" : "video/mp4";
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  return null;
}
