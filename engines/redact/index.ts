import { PDFDocument } from "pdf-lib";
import { loadPdf } from "@/engines/pdfjs";
import { extractAllText } from "@/engines/render";
import { AppError } from "@/lib/errors";
import type { Progress } from "@/workers/types";

/**
 * Redact engine (design §3, rasterize fallback path — true content removal).
 *
 * For each page that has redaction boxes we:
 *   1. render the page to a canvas,
 *   2. paint solid black over each box,
 *   3. flatten the canvas to a JPEG and rebuild that page from the image.
 * Because the page is rebuilt from a raster, the underlying text and image
 * data beneath (and around) the boxes is GONE — not merely covered. Pages
 * without boxes are copied through unchanged.
 *
 * We then re-extract text from the output and report how much text remains, so
 * the UI can show the "0 occurrences remain" verification card (F-SEC-4).
 *
 * Boxes are given in PDF points with a TOP-LEFT origin (natural for UI); we
 * convert to pdf.js device pixels for painting.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

/** A redaction box in PDF points, origin at the page's top-left. */
export interface RedactBox {
  page: number; // 1-based
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactResult {
  bytes: Uint8Array;
  /** Text that remains anywhere in the output (for verification). */
  remainingTextSample: string;
  /** Whether any of the originally-redacted terms could still be found. */
  verifiedClean: boolean;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toJpegBytes(canvas: HTMLCanvasElement, quality = 0.85): Promise<Uint8Array> {
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

export async function redact(
  data: Bytes,
  boxes: RedactBox[],
  opts: { dpi?: number; verifyTerms?: string[] } = {},
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<RedactResult> {
  if (boxes.length === 0) {
    throw new AppError("UnsupportedFeature", "Draw at least one redaction box.");
  }
  const input = data instanceof Uint8Array ? data : new Uint8Array(data);
  const dpi = opts.dpi ?? 150;
  const scale = dpi / 72;

  const byPage = new Map<number, RedactBox[]>();
  for (const b of boxes) {
    const list = byPage.get(b.page) ?? [];
    list.push(b);
    byPage.set(b.page, list);
  }

  const src = await loadPdf(input);
  const out = await PDFDocument.create();
  // Load a pdf-lib copy for pass-through pages.
  const srcLib = await PDFDocument.load(input, { ignoreEncryption: false }).catch(() => {
    throw new AppError("CorruptFile");
  });

  try {
    const total = src.numPages;
    for (let p = 1; p <= total; p++) {
      checkAbort(signal);
      const pageBoxes = byPage.get(p);
      if (!pageBoxes || pageBoxes.length === 0) {
        // Pass through untouched.
        const [copied] = await out.copyPages(srcLib, [p - 1]);
        out.addPage(copied);
      } else {
        const page = await src.getPage(p);
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
        // Paint boxes (points -> device px). Top-left origin matches canvas.
        ctx.fillStyle = "#000000";
        for (const b of pageBoxes) {
          ctx.fillRect(b.x * scale, b.y * scale, b.width * scale, b.height * scale);
        }
        const jpeg = await toJpegBytes(canvas);
        const img = await out.embedJpg(jpeg);
        const newPage = out.addPage([baseViewport.width, baseViewport.height]);
        newPage.drawImage(img, {
          x: 0,
          y: 0,
          width: baseViewport.width,
          height: baseViewport.height,
        });
        page.cleanup();
      }
      onProgress({ value: p / total, label: `Page ${p} of ${total}` });
      await yieldToUi();
    }

    const bytes = await out.save();

    // Verification: re-extract text from the output.
    const remaining = await extractAllText(bytes);
    let verifiedClean = true;
    if (opts.verifyTerms && opts.verifyTerms.length > 0) {
      const hay = remaining.toLowerCase();
      verifiedClean = !opts.verifyTerms.some((t) => t.trim() && hay.includes(t.toLowerCase()));
    }
    return {
      bytes,
      remainingTextSample: remaining.slice(0, 2000),
      verifiedClean,
    };
  } finally {
    await src.destroy();
  }
}
