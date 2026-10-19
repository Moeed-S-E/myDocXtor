import {
  PDFDocument,
  degrees,
  rgb,
  StandardFonts,
  PageSizes,
  type PDFImage,
} from "pdf-lib";
import { AppError } from "@/lib/errors";
import type { Progress } from "@/workers/types";

/**
 * Framework-free pdf-lib engines (design §3). Each function takes raw bytes,
 * reports progress, and checks an abort signal so it can run in a worker and
 * be unit tested in node. Outputs are returned as `Uint8Array` (transferable).
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;

const noop: OnProgress = () => {};

function u8(data: Bytes): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new AppError("Cancelled");
}

async function load(data: Bytes): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(u8(data), { ignoreEncryption: false });
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    if (/encrypt/i.test(msg)) {
      throw new AppError("PasswordRequired", undefined, { cause: err });
    }
    throw new AppError("CorruptFile", undefined, { cause: err });
  }
}

/** Merge multiple PDFs in order into a single document. */
export async function merge(
  files: Bytes[],
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (files.length < 2) {
    throw new AppError("UnsupportedFeature", "Add at least two PDFs to merge.");
  }
  const out = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    checkAbort(signal);
    const src = await load(files[i]!);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    onProgress({ value: (i + 1) / files.length, label: `File ${i + 1} of ${files.length}` });
  }
  return out.save();
}

/** Rotate the given 1-based pages (or all) by a multiple of 90 degrees. */
export async function rotate(
  data: Bytes,
  turnDegrees: number,
  pages1Based: number[] | "all",
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (turnDegrees % 90 !== 0) {
    throw new AppError("UnsupportedFeature", "Rotation must be a multiple of 90°.");
  }
  const doc = await load(data);
  const all = doc.getPages();
  const target = pages1Based === "all" ? all.map((_, i) => i + 1) : pages1Based;
  const set = new Set(target);
  for (let i = 0; i < all.length; i++) {
    checkAbort(signal);
    if (set.has(i + 1)) {
      const page = all[i]!;
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + turnDegrees) % 360));
    }
    onProgress({ value: (i + 1) / all.length, label: `Page ${i + 1} of ${all.length}` });
  }
  return doc.save();
}

/** Keep only the given 1-based pages, in the given order. */
export async function keepPages(
  data: Bytes,
  keep1Based: number[],
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const src = await load(data);
  const total = src.getPageCount();
  for (const p of keep1Based) {
    if (p < 1 || p > total) {
      throw new AppError("UnsupportedFeature", `Page ${p} is out of range (1–${total}).`);
    }
  }
  if (keep1Based.length === 0) {
    throw new AppError("UnsupportedFeature", "Select at least one page to keep.");
  }
  const out = await PDFDocument.create();
  const indices = keep1Based.map((p) => p - 1);
  const copied = await out.copyPages(src, indices);
  copied.forEach((page, i) => {
    checkAbort(signal);
    out.addPage(page);
    onProgress({ value: (i + 1) / copied.length, label: `Page ${i + 1} of ${copied.length}` });
  });
  return out.save();
}

/** Remove the given 1-based pages (keep the rest in original order). */
export async function removePages(
  data: Bytes,
  remove1Based: number[],
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const src = await load(data);
  const total = src.getPageCount();
  const removeSet = new Set(remove1Based);
  const keep = Array.from({ length: total }, (_, i) => i + 1).filter((p) => !removeSet.has(p));
  if (keep.length === 0) {
    throw new AppError("UnsupportedFeature", "You can't remove every page.");
  }
  return keepPages(data, keep, onProgress, signal);
}

/** Extract the given 1-based pages as a new PDF (preserves given order). */
export async function extractPages(
  data: Bytes,
  extract1Based: number[],
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  return keepPages(data, extract1Based, onProgress, signal);
}

/** Reorder pages to exactly the given 1-based permutation. */
export async function reorderPages(
  data: Bytes,
  order1Based: number[],
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const src = await load(data);
  const total = src.getPageCount();
  if (order1Based.length !== total) {
    throw new AppError(
      "UnsupportedFeature",
      `New order must list all ${total} pages exactly once.`,
    );
  }
  const seen = new Set(order1Based);
  if (seen.size !== total) {
    throw new AppError("UnsupportedFeature", "New order has duplicate or missing pages.");
  }
  return keepPages(data, order1Based, onProgress, signal);
}

export type SplitMode =
  | { kind: "ranges"; ranges: number[][] } // each inner array is 1-based pages → one output
  | { kind: "everyN"; n: number };

/** Split a PDF into multiple documents. Returns one Uint8Array per output. */
export async function splitPdf(
  data: Bytes,
  mode: SplitMode,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array[]> {
  const src = await load(data);
  const total = src.getPageCount();

  let groups: number[][];
  if (mode.kind === "everyN") {
    if (!Number.isInteger(mode.n) || mode.n < 1) {
      throw new AppError("UnsupportedFeature", "N must be a positive whole number.");
    }
    groups = [];
    for (let start = 1; start <= total; start += mode.n) {
      const group: number[] = [];
      for (let p = start; p < start + mode.n && p <= total; p++) group.push(p);
      groups.push(group);
    }
  } else {
    if (mode.ranges.length === 0) {
      throw new AppError("UnsupportedFeature", "Add at least one output range.");
    }
    groups = mode.ranges;
  }

  const outputs: Uint8Array[] = [];
  for (let g = 0; g < groups.length; g++) {
    checkAbort(signal);
    const group = groups[g]!;
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, group.map((p) => p - 1));
    copied.forEach((p) => out.addPage(p));
    outputs.push(await out.save());
    onProgress({ value: (g + 1) / groups.length, label: `Part ${g + 1} of ${groups.length}` });
  }
  return outputs;
}

export type NumberFormat = "n" | "page-n-of-m" | "roman";
export type Corner =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface PageNumberOptions {
  format: NumberFormat;
  position: Corner;
  start: number;
  fontSize: number;
  /** 1-based pages to number; omit for all. */
  pages?: number[];
}

function toRoman(num: number): string {
  const map: [number, string][] = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let n = num;
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

/** Stamp page numbers onto a PDF. */
export async function addPageNumbers(
  data: Bytes,
  opts: PageNumberOptions,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const doc = await load(data);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const targetSet = opts.pages ? new Set(opts.pages) : null;
  const margin = 24;

  for (let i = 0; i < total; i++) {
    checkAbort(signal);
    if (targetSet && !targetSet.has(i + 1)) continue;
    const page = pages[i]!;
    const display = opts.start + i;
    let text: string;
    if (opts.format === "roman") text = toRoman(display);
    else if (opts.format === "page-n-of-m") text = `Page ${display} of ${opts.start + total - 1}`;
    else text = String(display);

    const textWidth = font.widthOfTextAtSize(text, opts.fontSize);
    const { width, height } = page.getSize();
    const isTop = opts.position.startsWith("top");
    const y = isTop ? height - margin - opts.fontSize : margin;
    let x: number;
    if (opts.position.endsWith("left")) x = margin;
    else if (opts.position.endsWith("right")) x = width - margin - textWidth;
    else x = (width - textWidth) / 2;

    page.drawText(text, { x, y, size: opts.fontSize, font, color: rgb(0.2, 0.2, 0.2) });
    onProgress({ value: (i + 1) / total, label: `Page ${i + 1} of ${total}` });
  }
  return doc.save();
}

export interface WatermarkOptions {
  text: string;
  opacity: number; // 0..1
  rotationDegrees: number;
  fontSize: number;
  tile: boolean;
  pages?: number[];
}

/** Stamp a text watermark onto a PDF. */
export async function addWatermark(
  data: Bytes,
  opts: WatermarkOptions,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (!opts.text.trim()) {
    throw new AppError("UnsupportedFeature", "Enter watermark text.");
  }
  const doc = await load(data);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const total = pages.length;
  const targetSet = opts.pages ? new Set(opts.pages) : null;

  for (let i = 0; i < total; i++) {
    checkAbort(signal);
    if (targetSet && !targetSet.has(i + 1)) continue;
    const page = pages[i]!;
    const { width, height } = page.getSize();
    const draw = (cx: number, cy: number) => {
      const w = font.widthOfTextAtSize(opts.text, opts.fontSize);
      page.drawText(opts.text, {
        x: cx - w / 2,
        y: cy,
        size: opts.fontSize,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: Math.max(0, Math.min(1, opts.opacity)),
        rotate: degrees(opts.rotationDegrees),
      });
    };
    if (opts.tile) {
      const stepX = Math.max(120, opts.fontSize * 8);
      const stepY = Math.max(120, opts.fontSize * 6);
      for (let x = stepX / 2; x < width; x += stepX)
        for (let y = stepY / 2; y < height; y += stepY) draw(x, y);
    } else {
      draw(width / 2, height / 2);
    }
    onProgress({ value: (i + 1) / total, label: `Page ${i + 1} of ${total}` });
  }
  return doc.save();
}

export type PageSizeName = "fit" | "a4" | "letter";
export interface ImagesToPdfOptions {
  pageSize: PageSizeName;
  /** Points of margin around the image (ignored for "fit"). */
  margin: number;
  landscape: boolean;
}

/** Build a PDF from images (JPEG/PNG). One image per page, in order. */
export async function imagesToPdf(
  images: { bytes: Bytes; type: "jpeg" | "png" }[],
  opts: ImagesToPdfOptions,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new AppError("UnsupportedFeature", "Add at least one image.");
  }
  const doc = await PDFDocument.create();
  for (let i = 0; i < images.length; i++) {
    checkAbort(signal);
    const { bytes, type } = images[i]!;
    let img: PDFImage;
    try {
      img = type === "png" ? await doc.embedPng(u8(bytes)) : await doc.embedJpg(u8(bytes));
    } catch (err) {
      throw new AppError("CorruptFile", `Image ${i + 1} couldn't be read.`, { cause: err });
    }

    if (opts.pageSize === "fit") {
      const page = doc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    } else {
      const base = opts.pageSize === "a4" ? PageSizes.A4 : PageSizes.Letter;
      const [pw, ph] = opts.landscape ? [base[1], base[0]] : base;
      const page = doc.addPage([pw, ph]);
      const availW = pw - opts.margin * 2;
      const availH = ph - opts.margin * 2;
      const scale = Math.min(availW / img.width, availH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, {
        x: (pw - w) / 2,
        y: (ph - h) / 2,
        width: w,
        height: h,
      });
    }
    onProgress({ value: (i + 1) / images.length, label: `Image ${i + 1} of ${images.length}` });
  }
  return doc.save();
}

/** Read a PDF's page count without keeping the document. */
export async function getPageCount(data: Bytes): Promise<number> {
  const doc = await load(data);
  return doc.getPageCount();
}

export interface SignPlacement {
  page: number; // 1-based
  /** Position in PDF points, TOP-LEFT origin (converted internally). */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Embed a PNG signature image onto a page. Coordinates use a top-left origin
 * (UI convention); pdf-lib uses bottom-left, so we convert using page height.
 */
export async function signPdf(
  data: Bytes,
  pngBytes: Bytes,
  placement: SignPlacement,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const doc = await load(data);
  const pages = doc.getPages();
  const idx = placement.page - 1;
  if (idx < 0 || idx >= pages.length) {
    throw new AppError("UnsupportedFeature", `Page ${placement.page} is out of range.`);
  }
  checkAbort(signal);
  let img: PDFImage;
  try {
    img = await doc.embedPng(u8(pngBytes));
  } catch (err) {
    throw new AppError("CorruptFile", "Signature image couldn't be read.", { cause: err });
  }
  const page = pages[idx]!;
  const { height } = page.getSize();
  // Convert top-left Y to bottom-left Y.
  const yBottom = height - placement.y - placement.height;
  page.drawImage(img, {
    x: placement.x,
    y: yBottom,
    width: placement.width,
    height: placement.height,
  });
  onProgress({ value: 1, label: "Signed" });
  return doc.save();
}


export interface CropMargins {
  /** Margins to trim from each edge, in points. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Crop pages by setting the CropBox inset from the current MediaBox by the
 * given margins (points). Applies to all pages or a 1-based subset. Margins
 * are clamped so the box never inverts.
 */
export async function cropPdf(
  data: Bytes,
  margins: CropMargins,
  pages1Based: number[] | "all",
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const { top, right, bottom, left } = margins;
  if ([top, right, bottom, left].some((m) => m < 0)) {
    throw new AppError("UnsupportedFeature", "Margins cannot be negative.");
  }
  const doc = await load(data);
  const all = doc.getPages();
  const target = pages1Based === "all" ? all.map((_, i) => i + 1) : pages1Based;
  const set = new Set(target);

  for (let i = 0; i < all.length; i++) {
    checkAbort(signal);
    if (!set.has(i + 1)) continue;
    const page = all[i]!;
    // pdf-lib's getMediaBox gives the page box in its own coordinate space.
    const mb = page.getMediaBox();
    const x = mb.x + left;
    const y = mb.y + bottom;
    const width = mb.width - left - right;
    const height = mb.height - top - bottom;
    if (width <= 0 || height <= 0) {
      throw new AppError(
        "UnsupportedFeature",
        `Margins remove the whole of page ${i + 1} (box ${mb.width}×${mb.height}pt).`,
      );
    }
    page.setCropBox(x, y, width, height);
    onProgress({ value: (i + 1) / all.length, label: `Page ${i + 1} of ${all.length}` });
  }
  return doc.save();
}


/**
 * Copy / duplicate a PDF, optionally clearing identifying metadata
 * (title, author, subject, keywords, creator, producer, and dates). The copy
 * is a fresh pdf-lib round-trip of the original content.
 */
export async function copyPdf(
  data: Bytes,
  opts: { stripMetadata: boolean },
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  checkAbort(signal);
  const doc = await load(data);
  onProgress({ value: 0.5, label: "Duplicating…" });
  if (opts.stripMetadata) {
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setProducer("");
    doc.setCreator("");
    // Reset timestamps to the epoch so no original dates leak.
    const epoch = new Date(0);
    doc.setCreationDate(epoch);
    doc.setModificationDate(epoch);
  }
  onProgress({ value: 1, label: "Done" });
  return doc.save();
}

/** Read document metadata (for display before an optional strip). */
export async function readMetadata(data: Bytes): Promise<{
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}> {
  const doc = await load(data);
  return {
    title: doc.getTitle() ?? "",
    author: doc.getAuthor() ?? "",
    subject: doc.getSubject() ?? "",
    keywords: doc.getKeywords() ?? "",
    creator: doc.getCreator() ?? "",
    producer: doc.getProducer() ?? "",
  };
}
