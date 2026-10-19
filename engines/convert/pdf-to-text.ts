import { loadPdf } from "@/engines/pdfjs";
import type { Progress } from "@/workers/types";

/**
 * PDF → Markdown / plain text (design §3). Uses pdf.js text content with
 * position + font-height data, then simple heuristics to group items into
 * lines and classify lines as headings vs paragraphs. This is intentionally
 * lightweight (reflowed, not pixel-perfect) and the UI says so.
 *
 * The heuristic core (`linesToMarkdown`) is a pure function so it can be unit
 * tested without a browser.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

export interface TextLine {
  text: string;
  /** Representative font height (pt) for the line. */
  height: number;
}

/**
 * Convert classified lines to Markdown. Heading level is derived by comparing
 * a line's font height to the document's median body height:
 *   >= 1.8x → #, >= 1.4x → ##, >= 1.15x → ###, else paragraph.
 * Blank lines separate paragraphs.
 */
export function linesToMarkdown(lines: TextLine[]): string {
  const bodyHeights = lines.map((l) => l.height).filter((h) => h > 0).sort((a, b) => a - b);
  const median = bodyHeights.length
    ? bodyHeights[Math.floor(bodyHeights.length / 2)]!
    : 12;

  const out: string[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    if (!text) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    const ratio = line.height / median;
    if (ratio >= 1.8) out.push(`# ${text}`);
    else if (ratio >= 1.4) out.push(`## ${text}`);
    else if (ratio >= 1.15) out.push(`### ${text}`);
    else out.push(text);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Strip Markdown heading markers to produce plain text. */
export function markdownToPlainText(md: string): string {
  return md.replace(/^#{1,6}\s+/gm, "").trim() + "\n";
}

/** Extract classified lines from a PDF page using pdf.js positions. */
async function extractLines(
  doc: Awaited<ReturnType<typeof loadPdf>>,
  pageNumber: number,
): Promise<TextLine[]> {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  // Group items into lines by their Y position (transform[5]).
  const byRow = new Map<number, { text: string; height: number; x: number }[]>();
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const tr = item.transform as number[];
    const y = Math.round(tr[5]!);
    const height = Math.abs(tr[3]!) || item.height || 12;
    const row = byRow.get(y) ?? [];
    row.push({ text: item.str, height, x: tr[4]! });
    byRow.set(y, row);
  }
  // Sort rows top→bottom (larger Y first), items left→right.
  const rows = [...byRow.entries()].sort((a, b) => b[0] - a[0]);
  const lines: TextLine[] = [];
  for (const [, items] of rows) {
    items.sort((a, b) => a.x - b.x);
    const text = items.map((i) => i.text).join("").replace(/\s+/g, " ").trim();
    const height = Math.max(...items.map((i) => i.height));
    lines.push({ text, height });
  }
  page.cleanup();
  return lines;
}

export interface ExtractResult {
  markdown: string;
  text: string;
}

/** Extract the whole document as Markdown + plain text. */
export async function pdfToMarkdown(
  data: Bytes,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<ExtractResult> {
  const doc = await loadPdf(data);
  try {
    const allLines: TextLine[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      if (signal?.aborted) break;
      const lines = await extractLines(doc, p);
      allLines.push(...lines, { text: "", height: 0 });
      onProgress({ value: p / doc.numPages, label: `Page ${p} of ${doc.numPages}` });
    }
    const markdown = linesToMarkdown(allLines);
    return { markdown, text: markdownToPlainText(markdown) };
  } finally {
    await doc.destroy();
  }
}


export interface PageLines {
  pageNumber: number;
  lines: TextLine[];
}

/**
 * Extract classified lines grouped by page — shared by the Word/Excel
 * converters. Each page's lines preserve reading order (top→bottom,
 * left→right) and a representative font height per line.
 */
export async function extractDocumentLines(
  data: Bytes,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<PageLines[]> {
  const doc = await loadPdf(data);
  try {
    const pages: PageLines[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      if (signal?.aborted) break;
      const lines = (await extractLines(doc, p)).filter((l) => l.text.trim());
      pages.push({ pageNumber: p, lines });
      onProgress({ value: p / doc.numPages, label: `Page ${p} of ${doc.numPages}` });
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/** Heading level for a line from its height vs the document body median. */
export function headingLevelFor(height: number, medianBody: number): 0 | 1 | 2 | 3 {
  const ratio = height / (medianBody || 12);
  if (ratio >= 1.8) return 1;
  if (ratio >= 1.4) return 2;
  if (ratio >= 1.15) return 3;
  return 0;
}

/** Median body font height across all lines (for heading classification). */
export function medianBodyHeight(pages: PageLines[]): number {
  const heights = pages
    .flatMap((p) => p.lines.map((l) => l.height))
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  return heights.length ? heights[Math.floor(heights.length / 2)]! : 12;
}
