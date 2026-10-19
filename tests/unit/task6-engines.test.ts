import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { signPdf, getPageCount } from "@/engines/pdf-lib-ops";
import { PRESETS } from "@/engines/compress";
import { redact } from "@/engines/redact";
import { AppError } from "@/lib/errors";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]);
  return doc.save();
}

function tinyPng(): Uint8Array {
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

describe("signPdf", () => {
  it("embeds a signature without changing page count", async () => {
    const out = await signPdf(await makePdf(2), tinyPng(), {
      page: 1,
      x: 100,
      y: 100,
      width: 120,
      height: 40,
    });
    expect(await getPageCount(out)).toBe(2);
  });
  it("rejects an out-of-range page", async () => {
    await expect(
      signPdf(await makePdf(1), tinyPng(), { page: 5, x: 0, y: 0, width: 10, height: 10 }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("compress presets", () => {
  it("orders DPI light > balanced > strong", () => {
    expect(PRESETS.light.dpi).toBeGreaterThan(PRESETS.balanced.dpi);
    expect(PRESETS.balanced.dpi).toBeGreaterThan(PRESETS.strong.dpi);
  });
  it("keeps quality in 0..1", () => {
    for (const p of Object.values(PRESETS)) {
      expect(p.quality).toBeGreaterThan(0);
      expect(p.quality).toBeLessThanOrEqual(1);
    }
  });
});

describe("redact input validation", () => {
  it("rejects when no boxes are given", async () => {
    await expect(redact(await makePdf(1), [])).rejects.toBeInstanceOf(AppError);
  });
});
