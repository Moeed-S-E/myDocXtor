"use client";

import * as React from "react";
import { usePdfDoc } from "./use-pdf-doc";
import { PdfPageCanvas } from "./pdf-page-canvas";
import { cn } from "@/lib/utils";

interface PageThumbGridProps {
  source: File | Blob | ArrayBuffer | null;
  /** Controlled selection of 1-based page numbers. */
  selected?: Set<number>;
  onSelectionChange?: (selected: Set<number>) => void;
}

/**
 * Responsive thumbnail grid with click + shift-click selection and page-number
 * badges (UI steering §3.4). Virtualization-by-viewport is handled inside
 * PdfPageCanvas (renders only when scrolled near). Drag reorder and the hover
 * toolbar are added by the tools that need them in Phase 2.
 */
export function PageThumbGrid({
  source,
  selected,
  onSelectionChange,
}: PageThumbGridProps) {
  const { doc, pageCount, loading, error } = usePdfDoc(source);
  const [internal, setInternal] = React.useState<Set<number>>(new Set());
  const lastRef = React.useRef<number | null>(null);
  const sel = selected ?? internal;

  const setSel = (next: Set<number>) => {
    if (onSelectionChange) onSelectionChange(next);
    else setInternal(next);
  };

  const toggle = (page: number, shift: boolean) => {
    const next = new Set(sel);
    if (shift && lastRef.current !== null) {
      const start = Math.min(lastRef.current, page);
      const end = Math.max(lastRef.current, page);
      for (let p = start; p <= end; p++) next.add(p);
    } else if (next.has(page)) {
      next.delete(page);
    } else {
      next.add(page);
    }
    lastRef.current = page;
    setSel(next);
  };

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
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Loading pages…
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      role="listbox"
      aria-label="PDF pages"
      aria-multiselectable="true"
    >
      {Array.from({ length: pageCount }, (_, i) => {
        const page = i + 1;
        const isSelected = sel.has(page);
        return (
          <button
            key={page}
            type="button"
            role="option"
            aria-selected={isSelected}
            aria-label={`Page ${page}${isSelected ? ", selected" : ""}`}
            onClick={(e) => toggle(page, e.shiftKey)}
            className={cn(
              "group relative overflow-hidden rounded-md border-2 bg-white transition-colors duration-175 ease-out-soft",
              isSelected ? "border-primary" : "border-border hover:border-primary/40",
            )}
          >
            <PdfPageCanvas doc={doc} pageNumber={page} widthPx={240} />
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
              {page}
            </span>
          </button>
        );
      })}
    </div>
  );
}
