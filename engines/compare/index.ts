import { diff_match_patch, type Diff } from "diff-match-patch";
import pixelmatch from "pixelmatch";
import { extractAllText } from "@/engines/render";
import { loadPdf, renderPageBitmap } from "@/engines/pdfjs";
import type { Progress } from "@/workers/types";

/**
 * Compare two PDFs (design §3). Two modes:
 *  - Text diff: diff-match-patch over extracted text, summarized into
 *    insert/delete counts and a segment list.
 *  - Visual overlay: pixelmatch over rendered page bitmaps, producing a diff
 *    image per page and a changed-pixel count.
 *
 * `summarizeDiff` is pure and unit-testable.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

export interface DiffSegment {
  op: "equal" | "insert" | "delete";
  text: string;
}

export interface TextDiffResult {
  segments: DiffSegment[];
  insertions: number; // chars added
  deletions: number; // chars removed
  changed: boolean;
}

export function summarizeDiff(diffs: Diff[]): TextDiffResult {
  const segments: DiffSegment[] = [];
  let insertions = 0;
  let deletions = 0;
  for (const [op, text] of diffs) {
    if (op === 1) {
      segments.push({ op: "insert", text });
      insertions += text.length;
    } else if (op === -1) {
      segments.push({ op: "delete", text });
      deletions += text.length;
    } else {
      segments.push({ op: "equal", text });
    }
  }
  return { segments, insertions, deletions, changed: insertions > 0 || deletions > 0 };
}

/** Text diff between two PDFs' extracted text. */
export async function compareText(
  a: Bytes,
  b: Bytes,
  onProgress: OnProgress = noop,
): Promise<TextDiffResult> {
  onProgress({ value: 0.2, label: "Extracting text…" });
  const [ta, tb] = await Promise.all([extractAllText(a), extractAllText(b)]);
  onProgress({ value: 0.7, label: "Diffing…" });
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(ta, tb);
  dmp.diff_cleanupSemantic(diffs);
  onProgress({ value: 1, label: "Done" });
  return summarizeDiff(diffs);
}

export interface VisualPageDiff {
  pageNumber: number;
  diffBlob: Blob;
  changedPixels: number;
  totalPixels: number;
}

/** Visual overlay diff per page (up to the shorter document's page count). */
export async function compareVisual(
  a: Bytes,
  b: Bytes,
  opts: { widthPx?: number } = {},
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<VisualPageDiff[]> {
  const width = opts.widthPx ?? 800;
  const [docA, docB] = await Promise.all([loadPdf(a), loadPdf(b)]);
  try {
    const pages = Math.min(docA.numPages, docB.numPages);
    const results: VisualPageDiff[] = [];
    for (let p = 1; p <= pages; p++) {
      if (signal?.aborted) break;
      const [ra, rb] = await Promise.all([
        renderPageBitmap(docA, p, width),
        renderPageBitmap(docB, p, width),
      ]);
      const w = Math.min(ra.width, rb.width);
      const h = Math.min(ra.height, rb.height);
      const ca = bitmapToImageData(ra.bitmap, w, h);
      const cb = bitmapToImageData(rb.bitmap, w, h);
      ra.bitmap.close();
      rb.bitmap.close();
      const diff = new Uint8ClampedArray(w * h * 4);
      const changed = pixelmatch(ca.data, cb.data, diff, w, h, { threshold: 0.1 });
      const diffBlob = await imageDataToBlob(new ImageData(diff, w, h));
      results.push({ pageNumber: p, diffBlob, changedPixels: changed, totalPixels: w * h });
      onProgress({ value: p / pages, label: `Page ${p} of ${pages}` });
    }
    return results;
  } finally {
    await Promise.all([docA.destroy(), docB.destroy()]);
  }
}

function bitmapToImageData(bitmap: ImageBitmap, w: number, h: number): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

function imageDataToBlob(data: ImageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext("2d")!.putImageData(data, 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}
