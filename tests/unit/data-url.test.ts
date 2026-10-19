import { describe, it, expect } from "vitest";
import { dataUrlToBytes } from "@/lib/data-url";

describe("dataUrlToBytes", () => {
  it("decodes a base64 data URL to the original bytes", () => {
    // "PDF" -> base64 "UERG"
    const bytes = dataUrlToBytes("data:application/octet-stream;base64,UERG");
    expect(Array.from(bytes)).toEqual([0x50, 0x44, 0x46]);
  });

  it("round-trips arbitrary bytes", () => {
    const original = new Uint8Array([0, 255, 128, 1, 2, 3, 250]);
    const b64 = Buffer.from(original).toString("base64");
    const decoded = dataUrlToBytes(`data:image/jpeg;base64,${b64}`);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it("decodes a non-base64 (URL-encoded) data URL", () => {
    const decoded = dataUrlToBytes("data:text/plain,AB%20C");
    expect(new TextDecoder().decode(decoded)).toBe("AB C");
  });

  it("throws on a malformed data URL", () => {
    expect(() => dataUrlToBytes("not-a-data-url")).toThrow();
  });
});
