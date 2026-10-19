import { AppError } from "./errors";

/**
 * Parse a human page-range string like "1-3, 7, 9-12" into a sorted, unique,
 * 1-based page-number array. Validates against `pageCount`.
 *
 * Rules:
 *  - Whitespace is ignored; separators may be comma or space.
 *  - "a-b" is inclusive; a must be <= b.
 *  - Open ranges "-b" (from start) and "a-" (to end) are supported.
 *  - Out-of-bounds or malformed tokens throw AppError("UnsupportedFeature").
 */
export function parsePageRanges(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new AppError("UnsupportedFeature", "Enter at least one page or range.");
  }

  const pages = new Set<number>();
  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);

  const assertInBounds = (n: number) => {
    if (!Number.isInteger(n) || n < 1 || n > pageCount) {
      throw new AppError(
        "UnsupportedFeature",
        `Page ${n} is out of range (1–${pageCount}).`,
      );
    }
  };

  for (const token of tokens) {
    const range = token.match(/^(\d*)-(\d*)$/);
    if (range) {
      const start = range[1] === "" ? 1 : Number(range[1]);
      const end = range[2] === "" ? pageCount : Number(range[2]);
      assertInBounds(start);
      assertInBounds(end);
      if (start > end) {
        throw new AppError(
          "UnsupportedFeature",
          `Range "${token}" is backwards (start after end).`,
        );
      }
      for (let p = start; p <= end; p++) pages.add(p);
      continue;
    }
    if (/^\d+$/.test(token)) {
      const n = Number(token);
      assertInBounds(n);
      pages.add(n);
      continue;
    }
    throw new AppError("UnsupportedFeature", `Couldn't understand "${token}".`);
  }

  return [...pages].sort((a, b) => a - b);
}

/** Group a sorted page list into contiguous [start, end] runs. */
export function toContiguousRanges(pages: number[]): [number, number][] {
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  for (const p of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && p === last[1] + 1) last[1] = p;
    else ranges.push([p, p]);
  }
  return ranges;
}
