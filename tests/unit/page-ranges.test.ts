import { describe, it, expect } from "vitest";
import { parsePageRanges, toContiguousRanges } from "@/lib/page-ranges";
import { AppError } from "@/lib/errors";

describe("parsePageRanges", () => {
  it("parses mixed singles and ranges, sorted & unique", () => {
    expect(parsePageRanges("3, 1-3, 7, 9-12", 12)).toEqual([1, 2, 3, 7, 9, 10, 11, 12]);
  });
  it("supports open-ended ranges", () => {
    expect(parsePageRanges("-3", 10)).toEqual([1, 2, 3]);
    expect(parsePageRanges("8-", 10)).toEqual([8, 9, 10]);
  });
  it("tolerates spaces as separators", () => {
    expect(parsePageRanges("1 2  3", 5)).toEqual([1, 2, 3]);
  });
  it("throws on empty input", () => {
    expect(() => parsePageRanges("   ", 5)).toThrow(AppError);
  });
  it("throws on out-of-bounds", () => {
    expect(() => parsePageRanges("1-9", 5)).toThrow(/out of range/i);
  });
  it("throws on backwards range", () => {
    expect(() => parsePageRanges("7-3", 10)).toThrow(/backwards/i);
  });
  it("throws on garbage tokens", () => {
    expect(() => parsePageRanges("1,abc", 10)).toThrow(/understand/i);
  });
});

describe("toContiguousRanges", () => {
  it("groups contiguous runs", () => {
    expect(toContiguousRanges([1, 2, 3, 7, 9, 10])).toEqual([
      [1, 3],
      [7, 7],
      [9, 10],
    ]);
  });
});
