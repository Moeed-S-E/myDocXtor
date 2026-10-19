import { ocrPdf } from "@/engines/ocr";
import { pdfToWord } from "./pdf-to-word";
import { pdfToExcel } from "./pdf-to-excel";
import type { Progress } from "@/workers/types";

/**
 * OCR variants (design §3, F-FROM-6): for scanned PDFs, run OCR first to add a
 * searchable text layer, then convert the result to Word or Excel. This simply
 * composes the existing OCR and conversion engines, so there is no new parsing
 * logic — just a two-phase progress split.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

/** Scale a child engine's 0..1 progress into a [start,end] slice of the whole. */
function slice(onProgress: OnProgress, start: number, end: number): OnProgress {
  return (p) =>
    onProgress({
      value: p.value === null ? null : start + (end - start) * p.value,
      label: p.label,
    });
}

async function ocrFirst(
  data: Bytes,
  onProgress: OnProgress,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  return ocrPdf(
    data,
    { lang: "eng", dpi: 200 },
    slice(onProgress, 0, 0.7),
    signal,
  );
}

/** OCR a scanned PDF, then convert to Word. */
export async function ocrToWord(
  data: Bytes,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const searchable = await ocrFirst(data, onProgress, signal);
  return pdfToWord(searchable, slice(onProgress, 0.7, 1), signal);
}

/** OCR a scanned PDF, then convert to Excel. */
export async function ocrToExcel(
  data: Bytes,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const searchable = await ocrFirst(data, onProgress, signal);
  return pdfToExcel(searchable, slice(onProgress, 0.7, 1), signal);
}
