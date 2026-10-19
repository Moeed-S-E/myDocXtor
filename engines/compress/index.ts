import { PDFDocument } from "pdf-lib";
import { loadPdf } from "@/engines/pdfjs";
import { AppError } from "@/lib/errors";
import type { Progress } from "@/workers/types";

/**
 * Compress engine (design §3, JS path). Strategy: rasterize each page to a
 * JPEG at a target DPI/quality and rebuild the PDF from those images. This
 * reliably shrinks scan-heavy / image-heavy PDFs. Pages keep their original
 * point dimensions so layout is preserved; text becomes part of the image
 * (acceptable for the "compress" use-case and clearly the JS fallback path).
 *
 * Main-thread (needs Canvas). Yields between pages to keep the UI responsive.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

export type CompressPreset = "light" | "balanced" | "strong";

export const PRESETS: Record<CompressPreset, { dpi: number; quality: number }> = {
  light: { dpi: 150, quality: 0.8 },
  balanced: { dpi: 120, quality: 0.6 },
  strong: { dpi: 96, quality: 0.45 },
};

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toJpegBytes(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new AppError("Unknown", "Encoding failed."));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/jpeg",
      quality,
    );
  });
}

const checkAbort = (s?: AbortSignal) => {
  if (s?.aborted) throw new AppError("Cancelled");
};
const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

export interface CompressResult {
  bytes: Uint8Array;
  inputBytes: number;
  outputBytes: number;
}

export async function compress(
  data: Bytes,
  preset: CompressPreset,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<CompressResult> {
  const input = data instanceof Uint8Array ? data : new Uint8Array(data);
  const { dpi, quality } = PRESETS[preset];
  const scale = dpi / 72;

  const doc = await loadPdf(input);
  const out = await PDFDocument.create();
  try {
    const total = doc.numPages;
    for (let p = 1; p <= total; p++) {
      checkAbort(signal);
      const page = await doc.getPage(p);
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });
      const w = Math.ceil(viewport.width);
      const h = Math.ceil(viewport.height);
      const canvas = makeCanvas(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new AppError("UnsupportedFeature", "2D canvas unavailable.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const jpeg = await toJpegBytes(canvas, quality);
      const img = await out.embedJpg(jpeg);
      // Keep original page size (points), draw the raster to fill it.
      const newPage = out.addPage([baseViewport.width, baseViewport.height]);
      newPage.drawImage(img, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height,
      });
      page.cleanup();
      onProgress({ value: p / total, label: `Page ${p} of ${total}` });
      await yieldToUi();
    }
    const bytes = await out.save();
    return { bytes, inputBytes: input.length, outputBytes: bytes.length };
  } finally {
    await doc.destroy();
  }
}
