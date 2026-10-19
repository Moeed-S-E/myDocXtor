import pptxgen from "pptxgenjs";
import { renderPages } from "@/engines/render";
import type { Progress } from "@/workers/types";

/**
 * PDF → PowerPoint (design §3). One slide per page, with the rendered page
 * image filling the slide. Slide dimensions follow each page's aspect ratio.
 * Main-thread (rendering needs Canvas).
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

export async function pdfToPowerPoint(
  data: Bytes,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  // Render at a modest DPI — slides are display, not print.
  const rendered = await renderPages(
    data,
    { dpi: 120, format: "image/jpeg", quality: 0.82 },
    (p) => onProgress({ value: (p.value ?? 0) * 0.8, label: p.label }),
    signal,
  );

  const pptx = new pptxgen();
  pptx.defineLayout({ name: "PAGE", width: 10, height: 7.5 });
  pptx.layout = "PAGE";

  for (let i = 0; i < rendered.length; i++) {
    const r = rendered[i]!;
    const dataUrl = await blobToDataUrl(r.blob);
    const slide = pptx.addSlide();
    // Fit the image within a 10x7.5in slide, preserving aspect ratio.
    const slideW = 10;
    const slideH = 7.5;
    const imgRatio = r.width / r.height;
    const slideRatio = slideW / slideH;
    let w = slideW;
    let h = slideH;
    if (imgRatio > slideRatio) h = slideW / imgRatio;
    else w = slideH * imgRatio;
    slide.addImage({
      data: dataUrl,
      x: (slideW - w) / 2,
      y: (slideH - h) / 2,
      w,
      h,
    });
    onProgress({ value: 0.8 + (0.2 * (i + 1)) / rendered.length, label: `Slide ${i + 1} of ${rendered.length}` });
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  return new Uint8Array(await blob.arrayBuffer());
}
