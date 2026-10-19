import { describe, it, expect } from "vitest";
import {
  detectType,
  formatBytes,
  withExtension,
  isImageType,
} from "@/lib/files";

function blobFromBytes(bytes: number[]): Blob {
  return new Blob([new Uint8Array(bytes)]);
}

describe("detectType (magic bytes)", () => {
  it("detects PDF", async () => {
    expect(await detectType(blobFromBytes([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("pdf");
  });
  it("detects JPEG", async () => {
    expect(await detectType(blobFromBytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
  });
  it("detects PNG", async () => {
    expect(
      await detectType(blobFromBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("png");
  });
  it("detects WebP", async () => {
    const bytes = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    expect(await detectType(blobFromBytes(bytes))).toBe("webp");
  });
  it("detects HEIC", async () => {
    const bytes = [
      0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0,
    ];
    expect(await detectType(blobFromBytes(bytes))).toBe("heic");
  });
  it("returns unknown for junk", async () => {
    expect(await detectType(blobFromBytes([0x00, 0x01, 0x02, 0x03]))).toBe("unknown");
  });
});

describe("isImageType", () => {
  it("classifies image types", () => {
    expect(isImageType("jpeg")).toBe(true);
    expect(isImageType("png")).toBe(true);
    expect(isImageType("pdf")).toBe(false);
    expect(isImageType("unknown")).toBe(false);
  });
});

describe("formatBytes", () => {
  it("formats sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(18.4 * 1024 * 1024)).toBe("18.4 MB");
  });
});

describe("withExtension", () => {
  it("swaps an existing extension", () => {
    expect(withExtension("report.pdf", "docx")).toBe("report.docx");
  });
  it("appends when none present", () => {
    expect(withExtension("report", ".pdf")).toBe("report.pdf");
  });
});
