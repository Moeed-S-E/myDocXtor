import { AppError } from "./errors";

/** Max input size before we warn/refuse (design: up to 200 MB typical). */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;

export type DetectedType = "pdf" | "jpeg" | "png" | "webp" | "heic" | "unknown";

/**
 * Detect a file's real type by magic bytes, never by extension (design §5.1).
 * Reads only the first bytes, so this is cheap even for large files.
 */
export async function detectType(file: File | Blob): Promise<DetectedType> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const startsWith = (sig: number[], offset = 0): boolean =>
    sig.every((b, i) => head[offset + i] === b);

  // %PDF
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return "pdf";
  // JPEG: FF D8 FF
  if (startsWith([0xff, 0xd8, 0xff])) return "jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // WebP: RIFF....WEBP
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8))
    return "webp";
  // HEIC: ....ftyp(heic|heix|hevc|mif1)
  if (startsWith([0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...head.slice(8, 12));
    if (["heic", "heix", "hevc", "mif1", "heim", "heis"].includes(brand)) return "heic";
  }
  return "unknown";
}

export function isImageType(t: DetectedType): boolean {
  return t === "jpeg" || t === "png" || t === "webp" || t === "heic";
}

/** Validate a file for a tool; throws AppError on a clear problem. */
export async function validateFile(
  file: File,
  allow: ("pdf" | "image")[],
): Promise<DetectedType> {
  if (file.size > MAX_FILE_BYTES) {
    throw new AppError(
      "OutOfMemory",
      `File is ${formatBytes(file.size)}, over the ${formatBytes(MAX_FILE_BYTES)} limit.`,
    );
  }
  const type = await detectType(file);
  const ok =
    (allow.includes("pdf") && type === "pdf") ||
    (allow.includes("image") && isImageType(type));
  if (!ok) {
    throw new AppError("UnsupportedFeature", `Unexpected file type: ${type}.`);
  }
  return type;
}

/** Human-readable byte size, e.g. "18.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Swap or append an extension on a base filename. */
export function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base}.${ext.replace(/^\./, "")}`;
}
