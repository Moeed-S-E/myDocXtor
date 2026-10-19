"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Type, Square, Pencil, Undo2 } from "lucide-react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dropzone } from "@/components/file/dropzone";
import { FileCard } from "@/components/file/file-card";
import { Field } from "../controls";
import { ResultPanel, type ResultOutput } from "../result-panel";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import { loadPdf } from "@/engines/pdfjs";
import { bakeAnnotations, type Annotation, type RGB } from "@/engines/edit";
import { cn } from "@/lib/utils";

type Tool = "text" | "rect" | "freehand";

/** Fixed display width (px) for the editor canvas; also the px-per-point scale base. */
const DISPLAY_WIDTH = 720;

export function EditTool() {
  const tool = TOOLS_BY_SLUG["edit"]!;
  const runner = useMainThreadRunner();
  const [file, setFile] = React.useState<File | null>(null);
  const [bytes, setBytes] = React.useState<Uint8Array | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(0);
  const [scale, setScale] = React.useState(1); // display px per PDF point
  const [activeTool, setActiveTool] = React.useState<Tool>("text");
  const [color, setColor] = React.useState("#dc2626");
  const [annotations, setAnnotations] = React.useState<Annotation[]>([]);
  const [result, setResult] = React.useState<{ outputs: ResultOutput[]; inputBytes: number } | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const drawing = React.useRef<{ x: number; y: number; pts: { x: number; y: number }[] } | null>(null);
  const Icon = tool.icon;

  const hexToRgb = (hex: string): RGB => {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };

  const loadFile = async (f: File) => {
    setFile(f);
    const b = await fileToBytes(f);
    setBytes(b.slice());
    setAnnotations([]);
  };

  // Render the current page.
  React.useEffect(() => {
    let cancelled = false;
    if (!bytes) return;
    (async () => {
      const doc = await loadPdf(bytes.slice());
      if (cancelled) return void doc.destroy();
      setPageCount(doc.numPages);
      const safe = Math.min(page, doc.numPages);
      const pg = await doc.getPage(safe);
      const unscaled = pg.getViewport({ scale: 1 });
      const s = DISPLAY_WIDTH / unscaled.width;
      setScale(s);
      const viewport = pg.getViewport({ scale: s });
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await pg.render({ canvasContext: ctx, viewport }).promise;
      }
      pg.cleanup();
      await doc.destroy();
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, page]);

  const relPos = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const { x, y } = relPos(e);
    if (activeTool === "text") {
      const text = window.prompt("Text to add:");
      if (text) {
        setAnnotations((a) => [...a, { kind: "text", page, x, y, text, size: 16, color: hexToRgb(color) }]);
      }
      return;
    }
    drawing.current = { x, y, pts: [{ x, y }] };
    overlayRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current || activeTool === "text") return;
    if (activeTool === "freehand") {
      const { x, y } = relPos(e);
      drawing.current.pts.push({ x, y });
      setAnnotations((a) => a); // trigger preview via state tick handled below
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const start = drawing.current;
    const { x, y } = relPos(e);
    if (activeTool === "rect") {
      const rx = Math.min(start.x, x);
      const ry = Math.min(start.y, y);
      const w = Math.abs(x - start.x);
      const h = Math.abs(y - start.y);
      if (w > 3 && h > 3) {
        setAnnotations((a) => [...a, { kind: "rect", page, x: rx, y: ry, width: w, height: h, color: hexToRgb(color) }]);
      }
    } else if (activeTool === "freehand") {
      if (start.pts.length > 1) {
        setAnnotations((a) => [...a, { kind: "freehand", page, points: start.pts, width: 2, color: hexToRgb(color) }]);
      }
    }
    drawing.current = null;
  };

  const pageAnnotations = annotations.filter((a) => a.page === page);

  const save = async () => {
    if (!bytes) return;
    try {
      const out = await runner.run((onProgress, signal) =>
        bakeAnnotations(bytes.slice(), annotations, scale, onProgress, signal),
      );
      setResult({
        outputs: [
          {
            bytes: out,
            blob: bytesToPdfBlob(out),
            filename: (file?.name ?? "document.pdf").replace(/\.pdf$/i, "-edited.pdf"),
          },
        ],
        inputBytes: file?.size ?? out.length,
      });
    } catch {
      /* surfaced via runner.error */
    }
  };

  const startOver = () => {
    setFile(null);
    setBytes(null);
    setAnnotations([]);
    setResult(null);
    runner.reset();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to all tools">
          <Link href="/app/">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold">{tool.name}</h1>
          <p className="text-sm text-muted-foreground">{tool.description}</p>
        </div>
      </div>

      {runner.error && (
        <div role="alert" className="mb-4 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm">
          <p className="font-medium text-danger">{runner.error.title}</p>
          <p className="text-muted-foreground">{runner.error.nextStep}</p>
        </div>
      )}

      {result ? (
        <ResultPanel outputs={result.outputs} inputBytes={result.inputBytes} onStartOver={startOver} />
      ) : !file ? (
        <Dropzone accept={["pdf"]} multiple={false} onFiles={(f) => f[0] && loadFile(f[0])} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-3">
            <FileCard name={file.name} size={file.size} pageCount={pageCount || undefined} onRemove={startOver} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <span className="font-mono text-xs">Page {page} / {pageCount || "?"}</span>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
            <div
              ref={overlayRef}
              className="relative mx-auto w-full max-w-3xl touch-none select-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ cursor: activeTool === "text" ? "text" : "crosshair" }}
            >
              <canvas ref={canvasRef} className="w-full rounded-md border border-border" />
              {/* Annotation preview overlay (display-space) */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${canvasRef.current?.width ?? 1} ${canvasRef.current?.height ?? 1}`} preserveAspectRatio="none">
                {pageAnnotations.map((a, i) => {
                  const stroke = a.kind !== "text" ? `rgb(${a.color.r},${a.color.g},${a.color.b})` : undefined;
                  if (a.kind === "rect")
                    return <rect key={i} x={a.x} y={a.y} width={a.width} height={a.height} fill="none" stroke={stroke} strokeWidth={2} />;
                  if (a.kind === "freehand")
                    return <polyline key={i} points={a.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={stroke} strokeWidth={2} />;
                  return (
                    <text key={i} x={a.x} y={a.y} fill={`rgb(${a.color.r},${a.color.g},${a.color.b})`} fontSize={a.size}>
                      {a.text}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-4">
            {runner.status === "running" ? (
              <Progress value={runner.progress.value} label={runner.progress.label} onCancel={runner.cancel} />
            ) : (
              <>
                <Field label="Tool">
                  <div className="flex gap-1 rounded-md bg-muted p-1">
                    {([["text", Type], ["rect", Square], ["freehand", Pencil]] as const).map(([t, I]) => (
                      <button
                        key={t}
                        aria-pressed={activeTool === t}
                        onClick={() => setActiveTool(t)}
                        className={cn(
                          "flex flex-1 items-center justify-center rounded px-2 py-1.5 capitalize transition-colors",
                          activeTool === t ? "bg-card font-medium shadow-sm" : "text-muted-foreground",
                        )}
                        title={t}
                      >
                        <I className="size-4" />
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Color">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                </Field>
                <p className="text-xs text-muted-foreground">
                  {activeTool === "text"
                    ? "Click on the page to place text."
                    : activeTool === "rect"
                      ? "Drag to draw a rectangle."
                      : "Drag to draw freehand."}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pageAnnotations.length === 0}
                  onClick={() =>
                    setAnnotations((a) => {
                      let lastIdx = -1;
                      for (let i = 0; i < a.length; i++) if (a[i]!.page === page) lastIdx = i;
                      return lastIdx === -1 ? a : [...a.slice(0, lastIdx), ...a.slice(lastIdx + 1)];
                    })
                  }
                >
                  <Undo2 className="size-4" /> Undo last (this page)
                </Button>
                <Button onClick={save} disabled={annotations.length === 0}>
                  Save edits ({annotations.length})
                </Button>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
