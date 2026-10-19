"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Eraser, Paintbrush, Undo2, Redo2, Download, Info } from "lucide-react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/file/dropzone";
import { Field, Select } from "../controls";
import { cn } from "@/lib/utils";
import {
  fullMask,
  paintBrush,
  applyMaskToRGBA,
  compositeBackground,
  hexToRgba,
  type BackgroundSpec,
} from "@/engines/bgremove/image-utils";
import { AUTO_SEGMENTATION_ENABLED, MODEL_DOWNLOAD_LABEL } from "@/engines/bgremove/model";
import { downloadBlob } from "@/lib/download";

type BrushMode = "erase" | "restore";
type BgKind = "transparent" | "color" | "gradient";

interface ImageState {
  pixels: Uint8ClampedArray; // original RGBA
  width: number;
  height: number;
}

export function BackgroundRemoverTool() {
  const tool = TOOLS_BY_SLUG["background-remover"]!;
  const [image, setImage] = React.useState<ImageState | null>(null);
  const [mask, setMask] = React.useState<Uint8ClampedArray | null>(null);
  const [brush, setBrush] = React.useState<BrushMode>("erase");
  const [brushSize, setBrushSize] = React.useState(40);
  const [bgKind, setBgKind] = React.useState<BgKind>("transparent");
  const [color, setColor] = React.useState("#4f46e5");
  const [gradFrom, setGradFrom] = React.useState("#4f46e5");
  const [gradTo, setGradTo] = React.useState("#ec4899");
  const [showBefore, setShowBefore] = React.useState(false);
  const [exportFormat, setExportFormat] = React.useState<"png" | "jpg">("png");
  const [scale, setScale] = React.useState(1);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const painting = React.useRef(false);
  const undoStack = React.useRef<Uint8ClampedArray[]>([]);
  const redoStack = React.useRef<Uint8ClampedArray[]>([]);
  const [, forceRerender] = React.useReducer((x) => x + 1, 0);

  // Load an uploaded image file into pixels + a full mask.
  const loadFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
    // Cap very large images for responsiveness.
    const maxDim = 1600;
    const s = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * s);
    const h = Math.round(img.height * s);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const data = ctx.getImageData(0, 0, w, h);
    setImage({ pixels: data.data, width: w, height: h });
    setMask(fullMask(w, h));
    undoStack.current = [];
    redoStack.current = [];
  };

  const bgSpec = React.useCallback((): BackgroundSpec => {
    if (bgKind === "color") return { kind: "color", color: hexToRgba(color) };
    if (bgKind === "gradient")
      return { kind: "gradient", from: hexToRgba(gradFrom), to: hexToRgba(gradTo), vertical: true };
    return { kind: "transparent" };
  }, [bgKind, color, gradFrom, gradTo]);

  // Redraw the canvas whenever image/mask/bg/before changes.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !mask) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    // Compose pixels: original with mask applied, then background.
    const rgba = new Uint8ClampedArray(image.pixels); // copy
    if (!showBefore) {
      applyMaskToRGBA(rgba, mask);
      const composed = compositeBackground(rgba, image.width, image.height, bgSpec());
      ctx.putImageData(new ImageData(composed, image.width, image.height), 0, 0);
    } else {
      ctx.putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
    }
  });

  // Brush keyboard shortcuts: [ and ] adjust size.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "[") setBrushSize((s) => Math.max(4, s - 6));
      if (e.key === "]") setBrushSize((s) => Math.min(200, s + 6));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pushUndo = () => {
    if (!mask) return;
    undoStack.current.push(new Uint8ClampedArray(mask));
    if (undoStack.current.length > 30) undoStack.current.shift();
    redoStack.current = [];
  };

  const undo = () => {
    if (!mask || undoStack.current.length === 0) return;
    redoStack.current.push(new Uint8ClampedArray(mask));
    setMask(undoStack.current.pop()!);
  };
  const redo = () => {
    if (!mask || redoStack.current.length === 0) return;
    undoStack.current.push(new Uint8ClampedArray(mask));
    setMask(redoStack.current.pop()!);
  };

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (e.currentTarget.width / rect.width),
      y: (e.clientY - rect.top) * (e.currentTarget.height / rect.height),
    };
  };

  const paintAt = (x: number, y: number) => {
    if (!image || !mask) return;
    const next = new Uint8ClampedArray(mask);
    paintBrush(next, image.width, image.height, x, y, brushSize, brush === "erase" ? 0 : 255);
    setMask(next);
  };

  const exportImage = async () => {
    if (!image || !mask) return;
    const c = document.createElement("canvas");
    c.width = Math.round(image.width * scale);
    c.height = Math.round(image.height * scale);
    const ctx = c.getContext("2d")!;
    const rgba = new Uint8ClampedArray(image.pixels);
    applyMaskToRGBA(rgba, mask);
    const composed = compositeBackground(rgba, image.width, image.height, bgSpec());
    // Draw at native size then scale via drawImage.
    const tmp = document.createElement("canvas");
    tmp.width = image.width;
    tmp.height = image.height;
    tmp.getContext("2d")!.putImageData(new ImageData(composed, image.width, image.height), 0, 0);
    ctx.drawImage(tmp, 0, 0, c.width, c.height);
    const type = exportFormat === "png" ? "image/png" : "image/jpeg";
    // JPG can't be transparent; flatten onto white if needed.
    if (exportFormat === "jpg" && bgKind === "transparent") {
      const flat = document.createElement("canvas");
      flat.width = c.width;
      flat.height = c.height;
      const fctx = flat.getContext("2d")!;
      fctx.fillStyle = "#ffffff";
      fctx.fillRect(0, 0, c.width, c.height);
      fctx.drawImage(c, 0, 0);
      flat.toBlob((b) => b && downloadBlob(b, `cutout.${exportFormat}`), type, 0.92);
      return;
    }
    c.toBlob((b) => b && downloadBlob(b, `cutout.${exportFormat}`), type, 0.92);
  };

  const Icon = tool.icon;

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

      {!image ? (
        <div className="flex flex-col gap-4">
          <Dropzone
            accept={["image"]}
            multiple={false}
            onFiles={(files) => files[0] && loadFile(files[0])}
          />
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              {AUTO_SEGMENTATION_ENABLED
                ? `Automatic removal downloads a model once (${MODEL_DOWNLOAD_LABEL}).`
                : "Automatic AI removal isn't wired up yet — use the erase/restore brushes to remove the background manually. Everything stays on your device."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            {/* Checkerboard behind the canvas to show transparency. */}
            <div
              className="relative mx-auto max-w-full overflow-hidden rounded-md border border-border"
              style={{
                backgroundImage:
                  "conic-gradient(#e5e5e5 0 25%, #ffffff 0 50%, #e5e5e5 0 75%, #ffffff 0)",
                backgroundSize: "20px 20px",
              }}
            >
              <canvas
                ref={canvasRef}
                className="block h-auto w-full touch-none"
                role="img"
                aria-label="Image preview"
                onPointerDown={(e) => {
                  if (showBefore) return;
                  painting.current = true;
                  pushUndo();
                  const { x, y } = pointerPos(e);
                  paintAt(x, y);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!painting.current) return;
                  const { x, y } = pointerPos(e);
                  paintAt(x, y);
                }}
                onPointerUp={() => {
                  painting.current = false;
                  forceRerender();
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={brush === "erase" ? "default" : "outline"}
                size="sm"
                onClick={() => setBrush("erase")}
              >
                <Eraser className="size-4" /> Erase
              </Button>
              <Button
                variant={brush === "restore" ? "default" : "outline"}
                size="sm"
                onClick={() => setBrush("restore")}
              >
                <Paintbrush className="size-4" /> Restore
              </Button>
              <Button variant="ghost" size="sm" onClick={undo} aria-label="Undo">
                <Undo2 className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={redo} aria-label="Redo">
                <Redo2 className="size-4" />
              </Button>
              <label className="ml-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showBefore}
                  onChange={(e) => setShowBefore(e.target.checked)}
                />
                Show original
              </label>
            </div>
            <Field label={`Brush size: ${brushSize}px  ( [ / ] )`}>
              <input
                type="range"
                min={4}
                max={200}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                aria-label="Brush size"
              />
            </Field>
          </div>

          <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-4">
            <h2 className="font-medium">Background</h2>
            <div className="flex gap-1 rounded-md bg-muted p-1">
              {(["transparent", "color", "gradient"] as BgKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setBgKind(k)}
                  aria-pressed={bgKind === k}
                  className={cn(
                    "flex-1 rounded px-2 py-1.5 text-xs capitalize transition-colors",
                    bgKind === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            {bgKind === "color" && (
              <Field label="Color">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </Field>
            )}
            {bgKind === "gradient" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">
                  <input type="color" value={gradFrom} onChange={(e) => setGradFrom(e.target.value)} />
                </Field>
                <Field label="To">
                  <input type="color" value={gradTo} onChange={(e) => setGradTo(e.target.value)} />
                </Field>
              </div>
            )}

            <h2 className="mt-2 font-medium">Export</h2>
            <Field label="Format">
              <Select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as "png" | "jpg")}
              >
                <option value="png">PNG (keeps transparency)</option>
                <option value="jpg">JPG (white background)</option>
              </Select>
            </Field>
            <Field label="Resolution">
              <Select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                <option value={0.5}>50%</option>
                <option value={1}>100%</option>
                <option value={2}>200%</option>
              </Select>
            </Field>
            <Button onClick={exportImage}>
              <Download /> Download {exportFormat.toUpperCase()}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setImage(null);
                setMask(null);
              }}
            >
              Start over
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
