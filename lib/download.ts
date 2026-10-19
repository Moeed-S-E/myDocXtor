import { zipSync, type Zippable } from "fflate";

/** Trigger a client-side download of a blob via an anchor (no network). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function bytesToPdfBlob(bytes: Uint8Array): Blob {
  // Copy into a fresh ArrayBuffer-backed view for a well-typed BlobPart.
  return new Blob([bytes.slice()], { type: "application/pdf" });
}

/** Build a ZIP (in-memory, via fflate) from named byte arrays. */
export function zipFiles(files: { name: string; bytes: Uint8Array }[]): Blob {
  const entries: Zippable = {};
  for (const f of files) entries[f.name] = f.bytes;
  const zipped = zipSync(entries, { level: 6 });
  return new Blob([zipped.slice()], { type: "application/zip" });
}
