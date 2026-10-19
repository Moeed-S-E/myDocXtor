import { describe, it, expect } from "vitest";
import { applyScanMode, luminance } from "@/engines/scan/image-adjust";
import { displayToPdfX, displayToPdfY } from "@/engines/edit";

describe("applyScanMode", () => {
  function px(rgbs: number[][]): Uint8ClampedArray {
    const out = new Uint8ClampedArray(rgbs.length * 4);
    rgbs.forEach(([r, g, b], i) => {
      out[i * 4] = r!;
      out[i * 4 + 1] = g!;
      out[i * 4 + 2] = b!;
      out[i * 4 + 3] = 255;
    });
    return out;
  }

  it("grayscale sets all channels to luminance", () => {
    const p = px([[255, 0, 0]]);
    applyScanMode(p, "grayscale", { contrast: 1 });
    expect(p[0]).toBe(p[1]);
    expect(p[1]).toBe(p[2]);
    expect(p[0]).toBeCloseTo(Math.round(luminance(255, 0, 0)), 0);
  });

  it("bw thresholds to pure black or white", () => {
    const p = px([
      [255, 255, 255], // bright → white
      [0, 0, 0], // dark → black
    ]);
    applyScanMode(p, "bw", { threshold: 160 });
    expect([p[0], p[1], p[2]]).toEqual([255, 255, 255]);
    expect([p[4], p[5], p[6]]).toEqual([0, 0, 0]);
  });

  it("bw keeps alpha intact", () => {
    const p = px([[200, 200, 200]]);
    applyScanMode(p, "bw", { threshold: 160 });
    expect(p[3]).toBe(255);
  });

  it("color mode keeps distinct channels (no grayscaling)", () => {
    const p = px([[200, 100, 50]]);
    applyScanMode(p, "color", { contrast: 1 });
    expect(p[0]).not.toBe(p[1]);
  });
});

describe("edit coordinate mapping", () => {
  it("maps display X to PDF points by the scale", () => {
    expect(displayToPdfX(360, 2)).toBe(180);
  });
  it("flips Y from top-left (display) to bottom-left (PDF)", () => {
    // page 792pt tall, scale 2 → display 1584px; y=0 (top) → 792pt (top in PDF)
    expect(displayToPdfY(0, 2, 792)).toBe(792);
    // bottom of display → 0pt
    expect(displayToPdfY(1584, 2, 792)).toBe(0);
  });
});
