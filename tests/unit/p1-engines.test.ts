import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { cropPdf, getPageCount } from "@/engines/pdf-lib-ops";
import { linesToMarkdown, markdownToPlainText } from "@/engines/convert/pdf-to-text";
import { summarizeDiff } from "@/engines/compare";
import { AppError } from "@/lib/errors";

async function makePdf(pages: number, w = 612, h = 792): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([w, h]);
  return doc.save();
}

describe("cropPdf", () => {
  it("sets a smaller crop box without losing pages", async () => {
    const out = await cropPdf(await makePdf(2), { top: 20, right: 20, bottom: 20, left: 20 }, "all");
    const doc = await PDFDocument.load(out);
    expect(await getPageCount(out)).toBe(2);
    const cb = doc.getPages()[0]!.getCropBox();
    expect(cb.width).toBeCloseTo(612 - 40, 1);
    expect(cb.height).toBeCloseTo(792 - 40, 1);
  });
  it("rejects margins that remove the whole page", async () => {
    await expect(
      cropPdf(await makePdf(1), { top: 400, right: 0, bottom: 400, left: 0 }, "all"),
    ).rejects.toBeInstanceOf(AppError);
  });
  it("rejects negative margins", async () => {
    await expect(
      cropPdf(await makePdf(1), { top: -1, right: 0, bottom: 0, left: 0 }, "all"),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("linesToMarkdown", () => {
  it("promotes large lines to headings relative to body median", () => {
    const md = linesToMarkdown([
      { text: "Big Title", height: 28 },
      { text: "Body text one.", height: 12 },
      { text: "Body text two.", height: 12 },
      { text: "Body text three.", height: 12 },
    ]);
    expect(md).toMatch(/^# Big Title/m);
    expect(md).toMatch(/^Body text one\./m);
  });
  it("keeps same-size text as paragraphs", () => {
    const md = linesToMarkdown([
      { text: "a", height: 12 },
      { text: "b", height: 12 },
    ]);
    expect(md).not.toMatch(/#/);
  });
});

describe("markdownToPlainText", () => {
  it("strips heading markers", () => {
    expect(markdownToPlainText("# Title\n\nBody")).toBe("Title\n\nBody\n");
  });
});

describe("summarizeDiff", () => {
  it("counts insertions and deletions", () => {
    const res = summarizeDiff([
      [0, "same "],
      [-1, "old"],
      [1, "newer"],
    ]);
    expect(res.deletions).toBe(3);
    expect(res.insertions).toBe(5);
    expect(res.changed).toBe(true);
    expect(res.segments).toHaveLength(3);
  });
  it("reports no change when all equal", () => {
    const res = summarizeDiff([[0, "identical"]]);
    expect(res.changed).toBe(false);
  });
});
