"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "draw" | "type" | "upload";

interface SignaturePadProps {
  /** Called with a PNG data URL whenever the signature changes. */
  onChange: (pngDataUrl: string | null) => void;
}

/** Signature capture with Draw / Type / Upload tabs (UI steering §3.5). */
export function SignaturePad({ onChange }: SignaturePadProps) {
  const [tab, setTab] = React.useState<Tab>("draw");
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const [typed, setTyped] = React.useState("");

  const clearCanvas = React.useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, c.width, c.height);
    onChange(null);
  }, [onChange]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (e.currentTarget.width / rect.width),
      y: (e.clientY - rect.top) * (e.currentTarget.height / rect.height),
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const url = canvasRef.current?.toDataURL("image/png");
    if (url) onChange(url);
  };

  // Type tab: render text to an offscreen canvas as a PNG.
  React.useEffect(() => {
    if (tab !== "type") return;
    if (!typed.trim()) {
      onChange(null);
      return;
    }
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 200;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#111827";
    ctx.font = "64px 'Segoe Script', 'Brush Script MT', cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(typed, 20, 100);
    onChange(c.toDataURL("image/png"));
  }, [tab, typed, onChange]);

  const onUpload = async (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      onChange(c.toDataURL("image/png"));
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-md bg-muted p-1" role="tablist">
        {(["draw", "type", "upload"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded px-3 py-1.5 text-sm capitalize transition-colors",
              tab === t ? "bg-card font-medium shadow-sm" : "text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "draw" && (
        <div className="flex flex-col gap-2">
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className="h-40 w-full touch-none rounded-md border border-border bg-white"
            aria-label="Draw your signature"
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
          />
          <Button variant="ghost" size="sm" onClick={clearCanvas} className="self-start">
            Clear
          </Button>
        </div>
      )}

      {tab === "type" && (
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type your name"
          className="rounded-md border border-input bg-background px-3 py-2 text-2xl"
          style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}
          aria-label="Type your signature"
        />
      )}

      {tab === "upload" && (
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          aria-label="Upload a signature image"
          className="text-sm"
        />
      )}
    </div>
  );
}
