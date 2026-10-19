import { describe, it, expect } from "vitest";
import {
  fullMask,
  applyMaskToRGBA,
  paintBrush,
  compositeBackground,
  hexToRgba,
} from "@/engines/bgremove/image-utils";

describe("fullMask", () => {
  it("is all-opaque", () => {
    const m = fullMask(2, 2);
    expect(m.length).toBe(4);
    expect([...m]).toEqual([255, 255, 255, 255]);
  });
});

describe("applyMaskToRGBA", () => {
  it("writes mask values into the alpha channel", () => {
    const px = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
    const mask = new Uint8ClampedArray([128, 0]);
    applyMaskToRGBA(px, mask);
    expect(px[3]).toBe(128);
    expect(px[7]).toBe(0);
  });
});

describe("paintBrush", () => {
  it("erases (sets 0) at the brush center", () => {
    const w = 11;
    const h = 11;
    const mask = fullMask(w, h);
    paintBrush(mask, w, h, 5, 5, 3, 0, 1);
    expect(mask[5 * w + 5]).toBe(0); // center fully erased
    expect(mask[0]).toBe(255); // far corner untouched
  });
  it("restores (sets 255) over an erased area", () => {
    const w = 11;
    const h = 11;
    const mask = new Uint8ClampedArray(w * h); // all 0
    paintBrush(mask, w, h, 5, 5, 3, 255, 1);
    expect(mask[5 * w + 5]).toBe(255);
  });
});

describe("hexToRgba", () => {
  it("parses #rrggbb", () => {
    expect(hexToRgba("#4f46e5")).toEqual({ r: 0x4f, g: 0x46, b: 0xe5, a: 255 });
  });
  it("tolerates missing hash", () => {
    expect(hexToRgba("ffffff")).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });
});

describe("compositeBackground", () => {
  it("returns input unchanged for transparent", () => {
    const px = new Uint8ClampedArray([1, 2, 3, 128]);
    const out = compositeBackground(px, 1, 1, { kind: "transparent" });
    expect(out).toBe(px);
  });
  it("blends a solid color under a semi-transparent pixel", () => {
    // fg white @ 50% over black bg => ~127.5 each channel, alpha 255
    const px = new Uint8ClampedArray([255, 255, 255, 128]);
    const out = compositeBackground(px, 1, 1, {
      kind: "color",
      color: { r: 0, g: 0, b: 0, a: 255 },
    });
    expect(out[3]).toBe(255);
    expect(out[0]).toBeGreaterThan(120);
    expect(out[0]).toBeLessThan(135);
  });
  it("produces a horizontal gradient difference across width", () => {
    const px = new Uint8ClampedArray(2 * 1 * 4); // 2x1, fully transparent fg
    const out = compositeBackground(px, 2, 1, {
      kind: "gradient",
      from: { r: 0, g: 0, b: 0, a: 255 },
      to: { r: 255, g: 255, b: 255, a: 255 },
      vertical: false,
    });
    expect(out[0]).toBe(0); // left = from
    expect(out[4]).toBe(255); // right = to
  });
});
