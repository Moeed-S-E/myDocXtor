import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { AppError } from "@/lib/errors";
import type { Progress } from "@/workers/types";

/**
 * Edit PDF (design §3, F-EDIT-1): bake user annotations onto pages via pdf-lib.
 * The canvas editor works in DISPLAY pixels with a top-left origin; this engine
 * maps those to PDF points (bottom-left origin) using the per-page display
 * scale. `displayToPdf*` helpers are pure and unit-tested.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export type Annotation =
  | { kind: "text"; page: number; x: number; y: number; text: string; size: number; color: RGB }
  | { kind: "rect"; page: number; x: number; y: number; width: number; height: number; color: RGB }
  | { kind: "freehand"; page: number; points: { x: number; y: number }[]; width: number; color: RGB };

/** Map a display X (px) to PDF points. */
export function displayToPdfX(x: number, scale: number): number {
  return x / scale;
}
/** Map a display Y (px, top-left origin) to PDF Y (points, bottom-left). */
export function displayToPdfY(y: number, scale: number, pageHeightPt: number): number {
  return pageHeightPt - y / scale;
}

function toRgb(c: RGB) {
  return rgb(c.r / 255, c.g / 255, c.b / 255);
}

export async function bakeAnnotations(
  data: Bytes,
  annotations: Annotation[],
  /** Display scale used when the annotations were authored (px per point). */
  scale: number,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (annotations.length === 0) {
    throw new AppError("UnsupportedFeature", "Add at least one edit first.");
  }
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data instanceof Uint8Array ? data : new Uint8Array(data));
  } catch (err) {
    throw new AppError("CorruptFile", undefined, { cause: err });
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (let i = 0; i < annotations.length; i++) {
    if (signal?.aborted) throw new AppError("Cancelled");
    const a = annotations[i]!;
    const page = pages[a.page - 1];
    if (!page) continue;
    const { height } = page.getSize();

    if (a.kind === "text") {
      page.drawText(a.text, {
        x: displayToPdfX(a.x, scale),
        y: displayToPdfY(a.y, scale, height) - a.size, // baseline below the click point
        size: a.size,
        font,
        color: toRgb(a.color),
      });
    } else if (a.kind === "rect") {
      const yTop = displayToPdfY(a.y, scale, height);
      const hPt = a.height / scale;
      page.drawRectangle({
        x: displayToPdfX(a.x, scale),
        y: yTop - hPt,
        width: a.width / scale,
        height: hPt,
        borderColor: toRgb(a.color),
        borderWidth: 1.5,
      });
    } else {
      // freehand: draw connected line segments
      for (let p = 1; p < a.points.length; p++) {
        const p0 = a.points[p - 1]!;
        const p1 = a.points[p]!;
        page.drawLine({
          start: { x: displayToPdfX(p0.x, scale), y: displayToPdfY(p0.y, scale, height) },
          end: { x: displayToPdfX(p1.x, scale), y: displayToPdfY(p1.y, scale, height) },
          thickness: a.width,
          color: toRgb(a.color),
        });
      }
    }
    onProgress({ value: (i + 1) / annotations.length, label: `Edit ${i + 1} of ${annotations.length}` });
  }
  return doc.save();
}
