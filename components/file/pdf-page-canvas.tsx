"use client";

import * as React from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPageBitmap } from "@/engines/pdfjs";
import { cn } from "@/lib/utils";

interface PdfPageCanvasProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  /** Target render width in CSS px. */
  widthPx: number;
  className?: string;
}

/**
 * Renders one PDF page to a canvas, only when scrolled into view
 * (IntersectionObserver) so large documents stay cheap (design §2.5 batching).
 */
export function PdfPageCanvas({
  doc,
  pageNumber,
  widthPx,
  className,
}: PdfPageCanvasProps) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = React.useState(false);
  const [rendered, setRendered] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  React.useEffect(() => {
    if (!visible || rendered) return;
    let cancelled = false;
    (async () => {
      const { bitmap, width, height } = await renderPageBitmap(doc, pageNumber, widthPx);
      if (cancelled) {
        bitmap.close();
        return;
      }
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(bitmap, 0, 0);
      bitmap.close();
      setRendered(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, rendered, doc, pageNumber, widthPx]);

  return (
    <canvas
      ref={ref}
      className={cn("h-auto w-full bg-white", !rendered && "min-h-24 animate-pulse", className)}
      aria-label={`Page ${pageNumber}`}
      role="img"
    />
  );
}
