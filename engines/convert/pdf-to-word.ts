import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import {
  extractDocumentLines,
  medianBodyHeight,
  headingLevelFor,
  type PageLines,
} from "./pdf-to-text";
import type { Progress } from "@/workers/types";

/**
 * PDF → Word (design §3). Reflows extracted text into a .docx: lines whose
 * font size is notably larger than the body median become Heading 1/2/3; the
 * rest are body paragraphs. Page breaks are inserted between source pages.
 * Reflowed, editable output — not pixel-perfect — and the UI says so.
 *
 * `buildParagraphs` is a pure helper (unit-testable) that maps classified
 * lines to a docx paragraph spec.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const;

export interface ParagraphSpec {
  text: string;
  /** 0 = body, 1..3 = heading level. */
  heading: 0 | 1 | 2 | 3;
  pageBreakBefore: boolean;
}

/** Pure: classify page lines into paragraph specs with page breaks. */
export function buildParagraphs(pages: PageLines[]): ParagraphSpec[] {
  const median = medianBodyHeight(pages);
  const specs: ParagraphSpec[] = [];
  pages.forEach((page, pageIdx) => {
    page.lines.forEach((line, lineIdx) => {
      const text = line.text.trim();
      if (!text) return;
      specs.push({
        text,
        heading: headingLevelFor(line.height, median),
        pageBreakBefore: pageIdx > 0 && lineIdx === 0,
      });
    });
  });
  return specs;
}

export async function pdfToWord(
  data: Bytes,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const pages = await extractDocumentLines(data, (p) => onProgress({ ...p, label: p.label }), signal);
  const specs = buildParagraphs(pages);

  const paragraphs = specs.map((s) =>
    s.heading === 0
      ? new Paragraph({
          children: [new TextRun(s.text)],
          pageBreakBefore: s.pageBreakBefore,
        })
      : new Paragraph({
          heading: HEADING_MAP[s.heading],
          children: [new TextRun(s.text)],
          pageBreakBefore: s.pageBreakBefore,
        }),
  );

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
