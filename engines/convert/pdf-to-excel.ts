import * as XLSX from "xlsx";
import { loadPdf } from "@/engines/pdfjs";
import type { Progress } from "@/workers/types";

/**
 * PDF → Excel (design §3). Full table detection is hard; this reflows each
 * page's text into rows (grouped by Y) and splits each row into cells on wide
 * horizontal gaps, writing one sheet per page via SheetJS. The UI states this
 * is a best-effort reflow, not guaranteed table reconstruction.
 *
 * `groupIntoRows` is pure and unit-testable.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

export interface PositionedItem {
  text: string;
  x: number;
  y: number;
}

/**
 * Group positioned text items into a grid of rows/cells.
 *  - Rows: items sharing (approximately) the same Y, ordered top→bottom.
 *  - Cells: within a row, a new cell starts when the horizontal gap to the
 *    previous item exceeds `gapThreshold` (in text units).
 */
export function groupIntoRows(items: PositionedItem[], gapThreshold = 24): string[][] {
  if (items.length === 0) return [];
  // Bucket by rounded Y (tolerate sub-pixel differences).
  const byRow = new Map<number, PositionedItem[]>();
  for (const it of items) {
    const key = Math.round(it.y);
    const row = byRow.get(key) ?? [];
    row.push(it);
    byRow.set(key, row);
  }
  const sortedRows = [...byRow.entries()].sort((a, b) => b[0] - a[0]); // top→bottom
  const out: string[][] = [];
  for (const [, rowItems] of sortedRows) {
    rowItems.sort((a, b) => a.x - b.x);
    const cells: string[] = [];
    let prevRight: number | null = null;
    let current = "";
    for (const it of rowItems) {
      if (prevRight !== null && it.x - prevRight > gapThreshold) {
        cells.push(current.trim());
        current = "";
      }
      current += (current ? " " : "") + it.text;
      prevRight = it.x + it.text.length * 4; // rough advance estimate
    }
    if (current.trim()) cells.push(current.trim());
    if (cells.some((c) => c.length)) out.push(cells);
  }
  return out;
}

export async function pdfToExcel(
  data: Bytes,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const doc = await loadPdf(data);
  try {
    const wb = XLSX.utils.book_new();
    const total = doc.numPages;
    for (let p = 1; p <= total; p++) {
      if (signal?.aborted) break;
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items: PositionedItem[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const tr = item.transform as number[];
        items.push({ text: item.str, x: tr[4]!, y: tr[5]! });
      }
      page.cleanup();
      const rows = groupIntoRows(items);
      const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [[""]]);
      XLSX.utils.book_append_sheet(wb, ws, `Page ${p}`.slice(0, 31));
      onProgress({ value: p / total, label: `Page ${p} of ${total}` });
    }
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    return new Uint8Array(out);
  } finally {
    await doc.destroy();
  }
}
