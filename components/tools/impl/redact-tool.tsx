"use client";

import * as React from "react";
import { ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "../controls";
import { ToolWorkspace, type ToolRenderArgs, type LoadedFile } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import { redact, type RedactBox } from "@/engines/redact";
import { loadPdf } from "@/engines/pdfjs";
import { toUserMessage } from "@/lib/errors";

interface PendingBox extends RedactBox {
  id: string;
}

export function RedactTool() {
  const tool = TOOLS_BY_SLUG["redact"]!;
  const runner = useMainThreadRunner();
  const [current, setCurrent] = React.useState<LoadedFile | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(0);
  const [boxes, setBoxes] = React.useState<PendingBox[]>([]);
  const [verifyTerm, setVerifyTerm] = React.useState("");
  const [verification, setVerification] = React.useState<{ clean: boolean } | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // Canvas render state (points-per-css-pixel so boxes map to PDF points).
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [pageSizePt, setPageSizePt] = React.useState<{ w: number; h: number } | null>(null);
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);

  const onFilesChange = React.useCallback((files: LoadedFile[]) => {
    setCurrent(files[0] ?? null);
    setBoxes([]);
    setVerification(null);
  }, []);

  // Render the current page to the on-screen canvas at ~1 px/pt.
  React.useEffect(() => {
    let cancelled = false;
    if (!current) return;
    (async () => {
      const bytes = await fileToBytes(current.file);
      const doc = await loadPdf(bytes);
      if (cancelled) return void doc.destroy();
      setPageCount(doc.numPages);
      const safePage = Math.min(page, doc.numPages);
      const pg = await doc.getPage(safePage);
      const viewport = pg.getViewport({ scale: 1 }); // 1px = 1pt
      const canvas = canvasRef.current;
      if (!canvas) return void doc.destroy();
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await pg.render({ canvasContext: ctx, viewport }).promise;
      }
      setPageSizePt({ w: viewport.width, h: viewport.height });
      pg.cleanup();
      await doc.destroy();
    })();
    return () => {
      cancelled = true;
    };
  }, [current, page]);

  const canvasPoint = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = (pageSizePt?.w ?? rect.width) / rect.width;
    const scaleY = (pageSizePt?.h ?? rect.height) / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    const pageBoxes = boxes.filter((b) => b.page === page);
    return (
      <div className="flex flex-col gap-3">
        <FileCard
          name={f.file.name}
          size={f.file.size}
          pageCount={pageCount || undefined}
          onRemove={() => removeFile(f.id)}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <span className="font-mono text-xs">
            Page {page} / {pageCount || "?"}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            Next
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Drag on the page to mark areas to remove.
          </span>
        </div>
        <div
          className="relative mx-auto w-full max-w-xl touch-none select-none"
          onPointerDown={(e) => {
            dragStart.current = canvasPoint(e);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            const start = dragStart.current;
            dragStart.current = null;
            if (!start) return;
            const end = canvasPoint(e);
            const x = Math.min(start.x, end.x);
            const y = Math.min(start.y, end.y);
            const w = Math.abs(end.x - start.x);
            const h = Math.abs(end.y - start.y);
            if (w < 4 || h < 4) return;
            setBoxes((prev) => [
              ...prev,
              { id: crypto.randomUUID(), page, x, y, width: w, height: h },
            ]);
          }}
        >
          <canvas ref={canvasRef} className="h-auto w-full rounded-md border border-border" />
          {pageSizePt &&
            pageBoxes.map((b) => (
              <div
                key={b.id}
                className="absolute border-2 border-danger bg-danger/40"
                style={{
                  left: `${(b.x / pageSizePt.w) * 100}%`,
                  top: `${(b.y / pageSizePt.h) * 100}%`,
                  width: `${(b.width / pageSizePt.w) * 100}%`,
                  height: `${(b.height / pageSizePt.h) * 100}%`,
                }}
              />
            ))}
        </div>
      </div>
    );
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const apply = async () => {
      setLocalError(null);
      const f = files[0];
      if (!f) return;
      const bytes = await fileToBytes(f.file);
      try {
        const res = await runner.run((onProgress, signal) =>
          redact(
            bytes,
            boxes.map(({ page, x, y, width, height }) => ({ page, x, y, width, height })),
            { verifyTerms: verifyTerm.trim() ? [verifyTerm.trim()] : undefined },
            onProgress,
            signal,
          ),
        );
        setVerification({ clean: res.verifiedClean });
        setResult({
          outputs: [
            {
              bytes: res.bytes,
              blob: bytesToPdfBlob(res.bytes),
              filename: f.file.name.replace(/\.pdf$/i, "-redacted.pdf"),
            },
          ],
          inputBytes: f.file.size,
        });
      } catch (err) {
        setLocalError(toUserMessage(err).title);
      }
    };

    return (
      <>
        <p className="text-sm text-muted-foreground">
          {boxes.length} box{boxes.length === 1 ? "" : "es"} marked across the document.
        </p>
        {boxes.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setBoxes([])} className="self-start">
            <Trash2 className="size-4" /> Clear all boxes
          </Button>
        )}
        <Field
          label="Verify term (optional)"
          hint="We re-extract text after redaction to confirm this term is gone."
        >
          <TextInput
            value={verifyTerm}
            onChange={(e) => setVerifyTerm(e.target.value)}
            placeholder="e.g. a name or number"
          />
        </Field>
        {verification && (
          <div
            className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
              verification.clean
                ? "border-success/40 bg-success/5 text-success"
                : "border-warning/40 bg-warning/5 text-warning"
            }`}
          >
            {verification.clean ? (
              <ShieldCheck className="size-4 shrink-0" />
            ) : (
              <ShieldAlert className="size-4 shrink-0" />
            )}
            <span>
              {verification.clean
                ? "Verified: the term no longer appears in the output."
                : "The term still appears — check your boxes and redact again."}
            </span>
          </div>
        )}
        {localError && <p className="text-sm text-danger">{localError}</p>}
        <Button onClick={apply} disabled={boxes.length === 0}>
          Apply redactions permanently
        </Button>
        <p className="text-xs text-muted-foreground">
          Redacted pages are rebuilt from images, permanently removing the
          underlying text and graphics — not just covering them.
        </p>
      </>
    );
  };

  return (
    <ToolWorkspace
      tool={tool}
      status={runner.status}
      progress={runner.progress}
      error={runner.error}
      onCancel={runner.cancel}
      onReset={runner.reset}
      onFilesChange={onFilesChange}
      renderMain={main}
      renderOptions={options}
    />
  );
}
