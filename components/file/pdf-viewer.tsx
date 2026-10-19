"use client";

import * as React from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { usePdfDoc } from "./use-pdf-doc";
import { PdfPageCanvas } from "./pdf-page-canvas";
import { Button } from "@/components/ui/button";

interface PdfViewerProps {
  source: File | Blob | ArrayBuffer | null;
}

const ZOOM_STEPS = [320, 480, 640, 800, 1000];

/** Continuous-scroll PDF viewer with zoom and page jump (UI steering §3.4). */
export function PdfViewer({ source }: PdfViewerProps) {
  const { doc, pageCount, loading, error } = usePdfDoc(source);
  const [zoomIdx, setZoomIdx] = React.useState(1);
  const width = ZOOM_STEPS[zoomIdx] ?? 480;

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-4 text-sm">
        <p className="font-medium text-danger">{error.title}</p>
        <p className="text-muted-foreground">{error.nextStep}</p>
      </div>
    );
  }

  if (loading || !doc) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading preview…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">
          {pageCount} page{pageCount === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom out"
            disabled={zoomIdx === 0}
            onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
          >
            <ZoomOut />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom in"
            disabled={zoomIdx === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
          >
            <ZoomIn />
          </Button>
        </div>
      </div>
      <div className="flex max-h-[70vh] flex-col items-center gap-4 overflow-auto rounded-md bg-muted/40 p-4">
        {Array.from({ length: pageCount }, (_, i) => (
          <div
            key={i}
            className="shadow-sm"
            style={{ width: Math.min(width, 1000) }}
          >
            <PdfPageCanvas doc={doc} pageNumber={i + 1} widthPx={width} />
          </div>
        ))}
      </div>
    </div>
  );
}
