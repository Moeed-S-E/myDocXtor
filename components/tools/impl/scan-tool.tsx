"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Upload, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Field, Select } from "../controls";
import { ResultPanel, type ResultOutput } from "../result-panel";
import { usePdfLibRunner } from "../use-pdf-lib-runner";
import { bytesToPdfBlob } from "@/lib/download";
import { dataUrlToBytes } from "@/lib/data-url";
import { applyScanMode, type ScanMode } from "@/engines/scan/image-adjust";

interface ScanPage {
  id: string;
  /** Adjusted JPEG data URL for preview + compile. */
  dataUrl: string;
}

export function ScanTool() {
  const tool = TOOLS_BY_SLUG["scan"]!;
  const runner = usePdfLibRunner();
  const [pages, setPages] = React.useState<ScanPage[]>([]);
  const [mode, setMode] = React.useState<ScanMode>("color");
  const [threshold, setThreshold] = React.useState(160);
  const [cameraOn, setCameraOn] = React.useState(false);
  const [result, setResult] = React.useState<{ outputs: ResultOutput[]; inputBytes: number } | null>(null);
  const [camError, setCamError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const Icon = tool.icon;

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  React.useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCamError("Couldn't access the camera. You can upload photos instead.");
    }
  };

  /** Adjust an image element with the current scan mode → JPEG data URL. */
  const adjustToDataUrl = (source: CanvasImageSource, w: number, h: number): string => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(source, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    applyScanMode(imageData.data, mode, { threshold });
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const dataUrl = adjustToDataUrl(video, w, h);
    setPages((p) => [...p, { id: crypto.randomUUID(), dataUrl }]);
  };

  const onUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.src = url;
      });
      const dataUrl = adjustToDataUrl(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      setPages((p) => [...p, { id: crypto.randomUUID(), dataUrl }]);
    }
  };

  const move = (idx: number, dir: -1 | 1) =>
    setPages((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });

  const compile = async () => {
    const images = pages.map((pg) => ({
      bytes: dataUrlToBytes(pg.dataUrl),
      type: "jpeg" as const,
    }));
    try {
      const out = await runner.run("imagesToPdf", [
        images,
        { pageSize: "a4", margin: 24, landscape: false },
      ]);
      setResult({
        outputs: [{ bytes: out, blob: bytesToPdfBlob(out), filename: "scan.pdf" }],
        inputBytes: images.reduce((s, i) => s + i.bytes.length, 0),
      });
    } catch {
      /* surfaced via runner.error */
    }
  };

  const startOver = () => {
    stopCamera();
    setPages([]);
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
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            {cameraOn ? (
              <div className="flex flex-col gap-2">
                <video ref={videoRef} className="w-full rounded-md border border-border bg-black" playsInline muted />
                <div className="flex gap-2">
                  <Button onClick={capture}>
                    <Camera className="size-4" /> Capture page
                  </Button>
                  <Button variant="ghost" onClick={stopCamera}>
                    Stop camera
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={startCamera}>
                  <Camera className="size-4" /> Use camera
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                  <Upload className="size-4" /> Upload photos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => e.target.files && onUpload(e.target.files)}
                  />
                </label>
              </div>
            )}
            {camError && <p className="text-sm text-warning">{camError}</p>}

            {pages.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {pages.map((pg, i) => (
                  <div key={pg.id} className="flex flex-col gap-1 rounded-md border border-border p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pg.dataUrl} alt={`Scanned page ${i + 1}`} className="w-full rounded bg-white" />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-6" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-6" aria-label="Move down" disabled={i === pages.length - 1} onClick={() => move(i, 1)}>
                          <ArrowDown className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-6" aria-label="Remove" onClick={() => setPages((p) => p.filter((x) => x.id !== pg.id))}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-4">
            {runner.status === "running" ? (
              <Progress value={runner.progress.value} label={runner.progress.label} onCancel={runner.cancel} />
            ) : (
              <>
                <Field label="Scan mode" hint="Applied to new captures/uploads.">
                  <Select value={mode} onChange={(e) => setMode(e.target.value as ScanMode)}>
                    <option value="color">Color</option>
                    <option value="grayscale">Grayscale</option>
                    <option value="bw">Black &amp; white</option>
                  </Select>
                </Field>
                {mode === "bw" && (
                  <Field label={`Threshold: ${threshold}`}>
                    <input
                      type="range"
                      min={60}
                      max={240}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      aria-label="Black & white threshold"
                    />
                  </Field>
                )}
                <p className="text-xs text-muted-foreground">
                  The camera is used only on your device; frames never leave this tab.
                </p>
                <Button onClick={compile} disabled={pages.length === 0}>
                  Compile to PDF ({pages.length})
                </Button>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
