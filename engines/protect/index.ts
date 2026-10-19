import { PDFDocument as EncryptPDFDocument } from "pdf-lib-plus-encrypt";
import { PDFDocument } from "pdf-lib";
import { loadPdf } from "@/engines/pdfjs";
import { AppError } from "@/lib/errors";
import type { Progress } from "@/workers/types";

/**
 * Protect / Unlock (design §3, F-SEC-1 / F-SEC-2) — 100% MIT/permissive.
 *
 * PROTECT: `pdf-lib-plus-encrypt` (MIT fork of pdf-lib, AES via crypto-js/MIT)
 * applies a real AES password + permissions on save.
 *
 * UNLOCK: no permissive library can losslessly strip PDF encryption, so we use
 * the honest client-side pattern: pdf.js opens the document WITH the user's
 * password (decrypting it in memory), we render each page, and rebuild an
 * unprotected PDF from those page images via pdf-lib. This is lossy (text
 * becomes part of the page image) and the UI says so. We never guess passwords.
 *
 * Everything runs in-browser; no file or password leaves the device.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

function u8(data: Bytes): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export interface ProtectPermissions {
  printing: boolean;
  copying: boolean;
  modifying: boolean;
  annotating: boolean;
}

export interface ProtectOptions {
  userPassword: string;
  ownerPassword?: string;
  permissions: ProtectPermissions;
}

/** Set an AES password + permissions on a PDF. */
export async function protectPdf(
  data: Bytes,
  opts: ProtectOptions,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (!opts.userPassword) {
    throw new AppError("UnsupportedFeature", "Enter a password to protect the PDF.");
  }
  if (signal?.aborted) throw new AppError("Cancelled");
  let doc;
  try {
    doc = await EncryptPDFDocument.load(u8(data));
  } catch (err) {
    throw new AppError("CorruptFile", undefined, { cause: err });
  }
  onProgress({ value: 0.4, label: "Encrypting…" });
  await doc.encrypt({
    userPassword: opts.userPassword,
    ownerPassword: opts.ownerPassword || opts.userPassword,
    pdfVersion: "2.0", // AES-256 (revision 6)
    permissions: {
      printing: opts.permissions.printing ? "highResolution" : undefined,
      copying: opts.permissions.copying || undefined,
      modifying: opts.permissions.modifying || undefined,
      annotating: opts.permissions.annotating || undefined,
    },
  });
  onProgress({ value: 1, label: "Done" });
  return doc.save();
}

/**
 * Remove a password the user supplies by decrypting via pdf.js and rebuilding
 * an unprotected PDF from rendered page images. Lossy (text → image). We never
 * guess the password.
 */
export async function unlockPdf(
  data: Bytes,
  password: string,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) throw new AppError("Cancelled");
  // loadPdf maps PasswordException → PasswordRequired / WrongPassword for us.
  const doc = await loadPdf(u8(data), password || undefined);
  try {
    const out = await PDFDocument.create();
    const total = doc.numPages;
    const scale = 150 / 72; // 150 DPI rebuild
    for (let p = 1; p <= total; p++) {
      if (signal?.aborted) throw new AppError("Cancelled");
      const page = await doc.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new AppError("UnsupportedFeature", "2D canvas unavailable.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const jpeg: Blob = await new Promise((res) =>
        canvas.toBlob((b) => res(b!), "image/jpeg", 0.9),
      );
      const img = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()));
      const outPage = out.addPage([base.width, base.height]);
      outPage.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
      onProgress({ value: p / total, label: `Page ${p} of ${total}` });
    }
    return out.save();
  } finally {
    await doc.destroy();
  }
}
