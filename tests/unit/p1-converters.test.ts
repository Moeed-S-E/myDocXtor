import { describe, it, expect } from "vitest";
import { buildParagraphs } from "@/engines/convert/pdf-to-word";
import { groupIntoRows } from "@/engines/convert/pdf-to-excel";
import type { PageLines } from "@/engines/convert/pdf-to-text";

describe("buildParagraphs (PDF→Word)", () => {
  const pages: PageLines[] = [
    {
      pageNumber: 1,
      lines: [
        { text: "Big Heading", height: 28 },
        { text: "Body one.", height: 12 },
        { text: "Body two.", height: 12 },
        { text: "Body three.", height: 12 },
      ],
    },
    {
      pageNumber: 2,
      lines: [{ text: "Second page start", height: 12 }],
    },
  ];

  it("classifies large lines as headings and body as 0", () => {
    const specs = buildParagraphs(pages);
    expect(specs[0]).toMatchObject({ text: "Big Heading", heading: 1 });
    expect(specs[1]).toMatchObject({ text: "Body one.", heading: 0 });
  });

  it("marks a page break before the first line of later pages", () => {
    const specs = buildParagraphs(pages);
    const secondPageStart = specs.find((s) => s.text === "Second page start");
    expect(secondPageStart?.pageBreakBefore).toBe(true);
  });

  it("does not page-break the very first paragraph", () => {
    const specs = buildParagraphs(pages);
    expect(specs[0]!.pageBreakBefore).toBe(false);
  });
});

describe("groupIntoRows (PDF→Excel)", () => {
  it("groups items on the same Y into one row, ordered left→right", () => {
    const rows = groupIntoRows([
      { text: "B", x: 100, y: 700 },
      { text: "A", x: 10, y: 700 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(["A", "B"]);
  });

  it("splits a row into cells on wide horizontal gaps", () => {
    const rows = groupIntoRows(
      [
        { text: "Name", x: 10, y: 700 },
        { text: "Alice", x: 200, y: 700 },
      ],
      24,
    );
    expect(rows[0]).toEqual(["Name", "Alice"]);
  });

  it("orders rows top→bottom (higher Y first)", () => {
    const rows = groupIntoRows([
      { text: "bottom", x: 10, y: 100 },
      { text: "top", x: 10, y: 700 },
    ]);
    expect(rows[0]![0]).toBe("top");
    expect(rows[1]![0]).toBe("bottom");
  });

  it("returns empty for no items", () => {
    expect(groupIntoRows([])).toEqual([]);
  });
});
