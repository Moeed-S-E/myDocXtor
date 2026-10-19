/**
 * Scan image adjustments (design §3, F-ORG-8). Pure pixel transforms over an
 * RGBA Uint8ClampedArray so they are unit-testable in node. The UI applies
 * these to a captured/uploaded photo before compiling to a PDF.
 */

export type ScanMode = "color" | "grayscale" | "bw";

/** Luminance of an RGB pixel (Rec. 601). */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Apply a scan mode to RGBA pixels in place.
 *  - color: light contrast/brightness lift for a "scanned" look.
 *  - grayscale: luminance on all channels.
 *  - bw: luminance thresholded to pure black/white (threshold 0..255).
 */
export function applyScanMode(
  pixels: Uint8ClampedArray,
  mode: ScanMode,
  opts: { threshold?: number; contrast?: number } = {},
): Uint8ClampedArray {
  const threshold = opts.threshold ?? 160;
  const contrast = opts.contrast ?? 1.0;
  // Contrast factor around mid-gray.
  const adjust = (v: number) => clamp((v - 128) * contrast + 128);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    if (mode === "color") {
      pixels[i] = adjust(r);
      pixels[i + 1] = adjust(g);
      pixels[i + 2] = adjust(b);
    } else {
      const l = luminance(r, g, b);
      if (mode === "grayscale") {
        const v = adjust(l);
        pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
      } else {
        const v = l >= threshold ? 255 : 0;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
      }
    }
    // alpha untouched
  }
  return pixels;
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}
