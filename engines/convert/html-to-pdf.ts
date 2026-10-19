import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import DOMPurify from "dompurify";
import { AppError } from "@/lib/errors";
import type { Progress } from "@/workers/types";

/**
 * HTML → PDF (design §3). We SANITIZE the input with DOMPurify, then walk the
 * resulting DOM into a sequence of text blocks (headings, paragraphs, list
 * items) and lay them out with pdf-lib across A4 pages.
 *
 * Why not rasterize the DOM? Drawing an <svg><foreignObject> onto a canvas
 * taints it ("Tainted canvases may not be exported"), and html2canvas is a
 * heavy dependency with its own fidelity gaps. Text layout via pdf-lib is
 * reliable, fully on-device, and produces selectable text. Fidelity is
 * intentionally simple (structure + text, not full CSS) and the UI says so.
 * No URL input is offered and the CSP blocks remote assets (R-PRIV-1).
 */

type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

/** A4 at 72pt/in → 595x842 pt. */
const A4 = { w: 595, h: 842 };
const MARGIN = 54; // ~0.75in

interface Block {
  text: string;
  size: number;
  bold: boolean;
  bullet: boolean;
  spaceAfter: number;
}

const HEADING_SIZE: Record<string, number> = {
  H1: 24,
  H2: 20,
  H3: 16,
  H4: 14,
  H5: 13,
  H6: 12,
};

/** Walk sanitized DOM nodes into layout blocks. Exported for unit testing. */
export function domToBlocks(root: HTMLElement): Block[] {
  const blocks: Block[] = [];
  const visit = (el: Element) => {
    const tag = el.tagName;
    if (HEADING_SIZE[tag]) {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) blocks.push({ text, size: HEADING_SIZE[tag]!, bold: true, bullet: false, spaceAfter: 8 });
      return;
    }
    if (tag === "P") {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) blocks.push({ text, size: 11, bold: false, bullet: false, spaceAfter: 8 });
      return;
    }
    if (tag === "LI") {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) blocks.push({ text, size: 11, bold: false, bullet: true, spaceAfter: 4 });
      return;
    }
    if (tag === "BR") {
      blocks.push({ text: "", size: 11, bold: false, bullet: false, spaceAfter: 6 });
      return;
    }
    // Recurse into containers; collect loose text in leaf-ish elements.
    if (el.children.length === 0) {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) blocks.push({ text, size: 11, bold: false, bullet: false, spaceAfter: 6 });
      return;
    }
    for (const child of Array.from(el.children)) visit(child);
  };
  for (const child of Array.from(root.children)) visit(child);
  // Fallback: if nothing structured was found, dump the text.
  if (blocks.length === 0) {
    const text = (root.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ text, size: 11, bold: false, bullet: false, spaceAfter: 6 });
  }
  return blocks;
}

/** Greedy word-wrap a string to a max width in points. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function htmlToPdf(
  html: string,
  _opts: Record<string, never> = {},
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (!html.trim()) throw new AppError("UnsupportedFeature", "Paste or upload some HTML first.");

  onProgress({ value: 0.2, label: "Sanitizing…" });
  const safe = DOMPurify.sanitize(html, {
    FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "style"],
    FORBID_ATTR: ["onerror", "onload", "style"],
    ALLOW_DATA_ATTR: false,
  });
  const holder = document.createElement("div");
  holder.innerHTML = safe;
  const blocks = domToBlocks(holder);

  onProgress({ value: 0.5, label: "Laying out…" });
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = A4.w - MARGIN * 2;

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - MARGIN;
    }
  };

  for (const block of blocks) {
    if (signal?.aborted) throw new AppError("Cancelled");
    const useFont = block.bold ? bold : font;
    const indent = block.bullet ? 16 : 0;
    const prefix = block.bullet ? "•  " : "";
    const lines = wrap(
      prefix + block.text,
      useFont,
      block.size,
      contentWidth - indent,
    );
    const lineHeight = block.size * 1.35;
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, {
        x: MARGIN + indent,
        y: y - block.size,
        size: block.size,
        font: useFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= lineHeight;
    }
    y -= block.spaceAfter;
  }

  onProgress({ value: 1, label: "Done" });
  return pdf.save();
}
