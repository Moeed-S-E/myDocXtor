"use client";

import * as React from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf } from "@/engines/pdfjs";
import { toUserMessage, type UserMessage } from "@/lib/errors";

interface UsePdfDocResult {
  doc: PDFDocumentProxy | null;
  pageCount: number;
  loading: boolean;
  error: UserMessage | null;
}

/**
 * Loads a PDF from a File/Blob/bytes and keeps the document for rendering.
 * Destroys the document on unmount or when the source changes.
 */
export function usePdfDoc(source: File | Blob | ArrayBuffer | null): UsePdfDocResult {
  const [doc, setDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<UserMessage | null>(null);

  React.useEffect(() => {
    if (!source) {
      setDoc(null);
      setPageCount(0);
      return;
    }
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const buf =
          source instanceof ArrayBuffer ? source : await source.arrayBuffer();
        const d = await loadPdf(buf);
        if (cancelled) {
          await d.destroy();
          return;
        }
        loaded = d;
        setDoc(d);
        setPageCount(d.numPages);
      } catch (err) {
        if (!cancelled) setError(toUserMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [source]);

  return { doc, pageCount, loading, error };
}
