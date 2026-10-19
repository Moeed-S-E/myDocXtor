import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  merge,
  rotate,
  removePages,
  extractPages,
  reorderPages,
  splitPdf,
  addPageNumbers,
  addWatermark,
  imagesToPdf,
  getPageCount,
} from "@/engines/pdf-lib-ops";
import { AppError } from "@/lib/errors";

/** Build an N-page PDF (US Letter) as bytes. */
async function makePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([612, 792]);
  return doc.save();
}

/** A 1x1 red PNG. */
function tinyPng(): Uint8Array {
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

describe("merge", () => {
  it("concatenates page counts", async () => {
    const a = await makePdf(2);
    const b = await makePdf(3);
    const out = await merge([a, b]);
    expect(await getPageCount(out)).toBe(5);
  });
  it("requires at least two files", async () => {
    await expect(merge([await makePdf(1)])).rejects.toBeInstanceOf(AppError);
  });
});

describe("rotate", () => {
  it("rotates all pages by 90", async () => {
    const out = await rotate(await makePdf(2), 90, "all");
    const doc = await PDFDocument.load(out);
    expect(doc.getPages()[0]!.getRotation().angle).toBe(90);
  });
  it("rejects non-multiples of 90", async () => {
    await expect(rotate(await makePdf(1), 45, "all")).rejects.toBeInstanceOf(AppError);
  });
});

describe("removePages / extractPages", () => {
  it("removePages keeps the rest", async () => {
    const out = await removePages(await makePdf(5), [2, 4]);
    expect(await getPageCount(out)).toBe(3);
  });
  it("extractPages keeps only selected", async () => {
    const out = await extractPages(await makePdf(5), [1, 3, 5]);
    expect(await getPageCount(out)).toBe(3);
  });
  it("removePages refuses to remove everything", async () => {
    await expect(removePages(await makePdf(2), [1, 2])).rejects.toBeInstanceOf(AppError);
  });
});

describe("reorderPages", () => {
  it("accepts a full permutation", async () => {
    const out = await reorderPages(await makePdf(3), [3, 1, 2]);
    expect(await getPageCount(out)).toBe(3);
  });
  it("rejects an incomplete order", async () => {
    await expect(reorderPages(await makePdf(3), [1, 2])).rejects.toBeInstanceOf(AppError);
  });
  it("rejects duplicates", async () => {
    await expect(reorderPages(await makePdf(3), [1, 1, 2])).rejects.toBeInstanceOf(AppError);
  });
});

describe("splitPdf", () => {
  it("splits every N pages", async () => {
    const outs = await splitPdf(await makePdf(5), { kind: "everyN", n: 2 });
    expect(outs.length).toBe(3);
    expect(await getPageCount(outs[0]!)).toBe(2);
    expect(await getPageCount(outs[2]!)).toBe(1);
  });
  it("splits by custom ranges", async () => {
    const outs = await splitPdf(await makePdf(6), {
      kind: "ranges",
      ranges: [[1, 2, 3], [4, 5, 6]],
    });
    expect(outs.length).toBe(2);
    expect(await getPageCount(outs[1]!)).toBe(3);
  });
});

describe("addPageNumbers / addWatermark", () => {
  it("adds page numbers without changing page count", async () => {
    const out = await addPageNumbers(await makePdf(3), {
      format: "page-n-of-m",
      position: "bottom-center",
      start: 1,
      fontSize: 12,
    });
    expect(await getPageCount(out)).toBe(3);
  });
  it("adds a watermark without changing page count", async () => {
    const out = await addWatermark(await makePdf(2), {
      text: "DRAFT",
      opacity: 0.3,
      rotationDegrees: 45,
      fontSize: 48,
      tile: true,
    });
    expect(await getPageCount(out)).toBe(2);
  });
  it("rejects empty watermark text", async () => {
    await expect(
      addWatermark(await makePdf(1), {
        text: "  ",
        opacity: 0.3,
        rotationDegrees: 0,
        fontSize: 24,
        tile: false,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("imagesToPdf", () => {
  it("creates one page per image (fit)", async () => {
    const png = tinyPng();
    const out = await imagesToPdf(
      [
        { bytes: png, type: "png" },
        { bytes: png, type: "png" },
      ],
      { pageSize: "fit", margin: 0, landscape: false },
    );
    expect(await getPageCount(out)).toBe(2);
  });
  it("lays out on A4 with margins", async () => {
    const out = await imagesToPdf([{ bytes: tinyPng(), type: "png" }], {
      pageSize: "a4",
      margin: 24,
      landscape: true,
    });
    const doc = await PDFDocument.load(out);
    const { width, height } = doc.getPages()[0]!.getSize();
    expect(width).toBeGreaterThan(height); // landscape
  });
  it("rejects empty image list", async () => {
    await expect(
      imagesToPdf([], { pageSize: "fit", margin: 0, landscape: false }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
