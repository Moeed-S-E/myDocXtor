import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AppError } from "@/lib/errors";

/**
 * pdf.js engine (design §3). Framework-free so it can run in a worker and be
 * unit tested. The pdf.js worker is self-hosted (no CDN; design §6) by pointing
 * `workerSrc` at the bundled module worker via a URL relative to this module.
 */

let configured = false;
function configureWorker() {
  if (configured) return;
  // Self-host the pdf.js worker. Bundlers resolve this to a local asset.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  configured = true;
}

export interface PdfInfo {
  pageCount: number;
  /** True if the document required (and received) a password. */
  encrypted: boolean;
}

/** Load a PDF document from bytes. Throws typed AppErrors. */
export async function loadPdf(
  data: ArrayBuffer | Uint8Array,
  password?: string,
): Promise<PDFDocumentProxy> {
  configureWorker();
  try {
    const task = pdfjs.getDocument({
      data: data instanceof Uint8Array ? data : new Uint8Array(data),
      password,
      // Keep everything local; disable range/stream fetching of remote assets.
      disableAutoFetch: true,
      disableStream: true,
    });
    return await task.promise;
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "PasswordException") {
      // code 1 = need password, 2 = incorrect password
      const code = (err as { code?: number }).code;
      throw new AppError(code === 2 ? "WrongPassword" : "PasswordRequired", undefined, {
        cause: err,
      });
    }
    if (name === "InvalidPDFException") {
      throw new AppError("CorruptFile", undefined, { cause: err });
    }
    throw new AppError("Unknown", (err as Error)?.message, { cause: err });
  }
}

export async function getPdfInfo(
  data: ArrayBuffer | Uint8Array,
  password?: string,
): Promise<PdfInfo> {
  const doc = await loadPdf(data, password);
  try {
    const perms = await doc.getPermissions().catch(() => null);
    return { pageCount: doc.numPages, encrypted: perms !== null };
  } finally {
    await doc.destroy();
  }
}

/**
 * Render a single page to an ImageBitmap at a target CSS width (px). Returns
 * the bitmap and its natural dimensions. Uses OffscreenCanvas where available
 * (workers), falling back to a DOM canvas on the main thread.
 */
export async function renderPageBitmap(
  doc: PDFDocumentProxy,
  pageNumber: number,
  targetWidthPx: number,
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = targetWidthPx / unscaled.width;
  const viewport = page.getViewport({ scale });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);

  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new AppError("UnsupportedFeature", "2D canvas unavailable.");

  await page.render({
    canvasContext: ctx as CanvasRenderingContext2D,
    viewport,
  }).promise;

  const bitmap = await createImageBitmap(canvas as unknown as CanvasImageSource);
  page.cleanup();
  return { bitmap, width, height };
}
