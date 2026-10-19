import { loadPdf } from "@/engines/pdfjs";
import { AppError } from "@/lib/errors";
import type { Progress } from "@/workers/types";

/**
 * Raster/render engine (design §3). Runs on the main thread because pdf.js
 * rendering needs a Canvas 2D context. Heavy loops yield to keep the UI alive
 * (R-PERF-1) and observe an AbortSignal.
 *
 * PDF user-space is 72 units/inch, so scale = dpi / 72.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

export interface RenderedPage {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AppError("Unknown", "Encoding failed."))),
      type,
      quality,
    );
  });
}

const checkAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new AppError("Cancelled");
};
const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

/**
 * Render every page (or a subset) to an encoded image blob at `dpi`.
 * `format` is "image/jpeg" or "image/png".
 */
export async function renderPages(
  data: Bytes,
  opts: { dpi: number; format: "image/jpeg" | "image/png"; quality?: number; pages?: number[] },
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<RenderedPage[]> {
  const doc = await loadPdf(data);
  try {
    const scale = opts.dpi / 72;
    const targets = opts.pages ?? Array.from({ length: doc.numPages }, (_, i) => i + 1);
    const out: RenderedPage[] = [];
    for (let i = 0; i < targets.length; i++) {
      checkAbort(signal);
      const pageNumber = targets[i]!;
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      const canvas = makeCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new AppError("UnsupportedFeature", "2D canvas unavailable.");
      // White backing for JPEG (no alpha).
      if (opts.format === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await canvasToBlob(canvas, opts.format, opts.quality);
      out.push({ pageNumber, blob, width, height });
      page.cleanup();
      onProgress({ value: (i + 1) / targets.length, label: `Page ${i + 1} of ${targets.length}` });
      await yieldToUi();
    }
    return out;
  } finally {
    await doc.destroy();
  }
}

/** Extract the concatenated text of a page (for redaction verification). */
export async function extractPageText(data: Bytes, pageNumber: number): Promise<string> {
  const doc = await loadPdf(data);
  try {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ");
  } finally {
    await doc.destroy();
  }
}

/** Extract all text across the document. */
export async function extractAllText(data: Bytes): Promise<string> {
  const doc = await loadPdf(data);
  try {
    let all = "";
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      all += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
    }
    return all;
  } finally {
    await doc.destroy();
  }
}
