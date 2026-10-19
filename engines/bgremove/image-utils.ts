/**
 * Image utilities for the background remover (design §3). These are pure
 * functions over ImageData / typed arrays so they are unit-testable in node
 * without a browser. Rendering, encoding, and model inference live in the UI /
 * model modules.
 *
 * The "mask" is a single-channel Uint8ClampedArray (0..255) the size of the
 * image: 255 = fully foreground (opaque), 0 = fully background (transparent).
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Apply an alpha mask to RGBA pixels in place: out.alpha = mask value. */
export function applyMaskToRGBA(
  pixels: Uint8ClampedArray,
  mask: Uint8ClampedArray,
): Uint8ClampedArray {
  const n = mask.length;
  for (let i = 0; i < n; i++) {
    pixels[i * 4 + 3] = mask[i]!;
  }
  return pixels;
}

/** A fully-opaque mask (everything foreground) — the manual-edit starting point. */
export function fullMask(width: number, height: number): Uint8ClampedArray {
  const m = new Uint8ClampedArray(width * height);
  m.fill(255);
  return m;
}

/**
 * Paint a soft circular brush into the mask. `value` is 0 (erase→transparent)
 * or 255 (restore→opaque). `hardness` in 0..1 controls edge softness.
 */
export function paintBrush(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  value: number,
  hardness = 0.8,
): void {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  const inner = radius * hardness;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      // Feather between inner radius and outer radius.
      let t = 1;
      if (d > inner && radius > inner) t = 1 - (d - inner) / (radius - inner);
      const idx = y * width + x;
      const current = mask[idx]!;
      mask[idx] = Math.round(current + (value - current) * t);
    }
  }
}

export type BackgroundSpec =
  | { kind: "transparent" }
  | { kind: "color"; color: RGBA }
  | { kind: "gradient"; from: RGBA; to: RGBA; vertical: boolean };

/**
 * Composite foreground (RGBA with mask already applied to alpha) over a
 * background spec, returning new RGBA pixels. For "transparent" the input is
 * returned unchanged.
 */
export function compositeBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bg: BackgroundSpec,
): Uint8ClampedArray {
  if (bg.kind === "transparent") return pixels;
  const out = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const bgc = backgroundColorAt(bg, x, y, width, height);
      const fa = pixels[i + 3]! / 255;
      // Source-over: out = fg*fa + bg*(1-fa).
      out[i] = Math.round(pixels[i]! * fa + bgc.r * (1 - fa));
      out[i + 1] = Math.round(pixels[i + 1]! * fa + bgc.g * (1 - fa));
      out[i + 2] = Math.round(pixels[i + 2]! * fa + bgc.b * (1 - fa));
      out[i + 3] = 255;
    }
  }
  return out;
}

function backgroundColorAt(
  bg: Exclude<BackgroundSpec, { kind: "transparent" }>,
  x: number,
  y: number,
  width: number,
  height: number,
): RGBA {
  if (bg.kind === "color") return bg.color;
  const t = bg.vertical ? y / Math.max(1, height - 1) : x / Math.max(1, width - 1);
  return {
    r: bg.from.r + (bg.to.r - bg.from.r) * t,
    g: bg.from.g + (bg.to.g - bg.from.g) * t,
    b: bg.from.b + (bg.to.b - bg.from.b) * t,
    a: 255,
  };
}

/** Parse a #rrggbb hex string to RGBA (alpha 255). */
export function hexToRgba(hex: string): RGBA {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0, a: 255 };
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
}
