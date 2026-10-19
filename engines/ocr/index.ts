import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { loadPdf } from "@/engines/pdfjs";
import { AppError } from "@/lib/errors";
import type { Progress } from "@/workers/types";

/**
 * OCR engine (design §3). Tesseract.js is Apache-2.0 (permissive). All assets
 * are SELF-HOSTED so nothing is fetched from a CDN at runtime (R-PRIV-1):
 *   - worker:   /tesseract/worker.min.js
 *   - core:     /tesseract/tesseract-core-simd-lstm.wasm.js
 *   - langData: /tessdata/   (eng.traineddata.gz)
 *
 * Pipeline per page: render to a bitmap (via pdf.js) → Tesseract recognize →
 * draw each recognized word as INVISIBLE text (renderingMode 3 / 0 opacity) at
 * its bounding box on the original page, so the PDF looks identical but becomes
 * searchable/selectable. Main-thread (Tesseract spins its own worker).
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Flatten recognized words from a Tesseract v6 result. Words live under
 * blocks → paragraphs → lines → words; older/flat shapes expose `data.words`.
 * We read whichever is present without relying on the (looser) public types.
 */
function flattenWords(result: unknown): OcrWord[] {
  const r = result as {
    words?: OcrWord[];
    blocks?: Array<{
      paragraphs?: Array<{ lines?: Array<{ words?: OcrWord[] }> }>;
    }>;
  };
  if (Array.isArray(r.words) && r.words.length) return r.words;
  const out: OcrWord[] = [];
  for (const block of r.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const w of line.words ?? []) out.push(w);
      }
    }
  }
  return out;
}

const TESS_WORKER = "/tesseract/worker.min.js";
const TESS_CORE = "/tesseract/";
const TESS_LANG = "/tessdata/";

async function renderToDataUrl(
  doc: Awaited<ReturnType<typeof loadPdf>>,
  pageNumber: number,
  dpi: number,
): Promise<{ dataUrl: string; widthPt: number; heightPt: number; scale: number }> {
  const page = await doc.getPage(pageNumber);
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });
  const base = page.getViewport({ scale: 1 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AppError("UnsupportedFeature", "2D canvas unavailable.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthPt: base.width,
    heightPt: base.height,
    scale,
  };
}

export interface OcrOptions {
  /** Tesseract language code(s), e.g. "eng". */
  lang?: string;
  /** Render DPI for recognition (300 recommended). */
  dpi?: number;
}

/**
 * Add an invisible OCR text layer to a PDF, returning new searchable bytes.
 */
export async function ocrPdf(
  data: Bytes,
  opts: OcrOptions = {},
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const lang = opts.lang ?? "eng";
  const dpi = opts.dpi ?? 300;

  // Load the prebuilt browser bundle from our own origin at runtime. Using an
  // indirect URL string stops both tsc and webpack from statically resolving
  // (and transforming) it — it's already a self-contained ESM build. The
  // same-origin URL keeps it CSP-safe. All tesseract assets (worker, core WASM,
  // lang data) are self-hosted — nothing is fetched from a CDN (R-PRIV-1).
  //
  // NOTE: the ESM bundle exposes its API on the DEFAULT export; there are no
  // named exports, so we read `module.default.createWorker`.
  let createWorker: typeof import("/tesseract/tesseract.esm.min.js").createWorker;
  try {
    // webpackIgnore must be on a STRING LITERAL import to be honored — a
    // variable specifier is still processed by webpack and breaks the module
    // (its default export comes back undefined). The literal below makes this a
    // native runtime import of our self-hosted asset, exactly like the probe.
    const tesseract = await import(/* webpackIgnore: true */ "/tesseract/tesseract.esm.min.js");
    createWorker = tesseract.default.createWorker;
  } catch (e) {
    throw new AppError("Unknown", `OCR engine failed to load: ${String((e as Error)?.message ?? e)}`, { cause: e });
  }

  const input = data instanceof Uint8Array ? data : new Uint8Array(data);
  // pdf.js (loadPdf) takes ownership of / detaches the bytes it is given, so
  // pdf-lib must load from an independent COPY — otherwise PDFDocument.load
  // reads a detached ArrayBuffer and throws. Make the copy BEFORE loadPdf.
  const pdfLibCopy = input.slice();
  const renderDoc = await loadPdf(input);
  const outDoc = await PDFDocument.load(pdfLibCopy);
  const font = await outDoc.embedFont(StandardFonts.Helvetica);

  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker(lang, 1, {
      workerPath: TESS_WORKER,
      corePath: TESS_CORE,
      langPath: TESS_LANG,
      workerBlobURL: false,
      cacheMethod: "none",
    });
  } catch (e) {
    throw new AppError("Unknown", `OCR engine failed to start: ${String((e as Error)?.message ?? e)}`, { cause: e });
  }

  try {
    const total = renderDoc.numPages;
    const outPages = outDoc.getPages();
    for (let p = 1; p <= total; p++) {
      if (signal?.aborted) throw new AppError("Cancelled");
      onProgress({ value: (p - 1) / total, label: `Reading page ${p} of ${total}` });
      const { dataUrl, heightPt, scale } = await renderToDataUrl(renderDoc, p, dpi);
      const { data: result } = await worker.recognize(dataUrl, {}, { blocks: true });

      const page = outPages[p - 1]!;
      // Tesseract word boxes are in render-pixel space; divide by scale → points.
      const words = flattenWords(result);
      for (const w of words) {
        const text = w.text?.trim();
        if (!text) continue;
        const xPt = w.bbox.x0 / scale;
        const wPt = (w.bbox.x1 - w.bbox.x0) / scale;
        const hPt = (w.bbox.y1 - w.bbox.y0) / scale;
        // pdf.js/tesseract use top-left origin; pdf-lib bottom-left.
        const yPt = heightPt - w.bbox.y1 / scale;
        const size = Math.max(4, hPt);
        page.drawText(text, {
          x: xPt,
          y: yPt,
          size,
          font,
          color: rgb(0, 0, 0),
          opacity: 0, // invisible: visual layer unchanged, text now selectable
          maxWidth: wPt > 0 ? wPt * 4 : undefined,
        });
      }
      onProgress({ value: p / total, label: `Page ${p} of ${total}` });
    }
    return outDoc.save();
  } finally {
    await worker.terminate();
    await renderDoc.destroy();
  }
}
