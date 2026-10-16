export const MB = 1024 * 1024;

export type FileKind = "cv" | "placement_letter" | "avatar" | "company_logo" | "verification_doc" | "cv_builder";
export type BucketId = "cvs" | "placement-letters" | "avatars" | "company-logos" | "verification-docs";

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
    maxBytes: 2 * MB,
    label: "Photo (JPG, PNG or WebP, max 2MB)",
  },
  company_logo: {
    bucket: "company-logos",
    folder: "company",
    mimes: ["image/jpeg", "image/png", "image/webp"],
    extensions: ["jpg", "jpeg", "png", "webp"],
    maxBytes: 1 * MB,
    label: "Logo (JPG, PNG or WebP, max 1MB)",
  },
  verification_doc: {
    bucket: "verification-docs",
    folder: "company",
    mimes: ["application/pdf", "image/jpeg", "image/png"],
    extensions: ["pdf", "jpg", "jpeg", "png"],
    maxBytes: 5 * MB,
    label: "Document (PDF, JPG or PNG, max 5MB)",
  },
};

/** Detects the real file type from its first bytes (never trust the extension or declared MIME). */
export function sniffMime(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
