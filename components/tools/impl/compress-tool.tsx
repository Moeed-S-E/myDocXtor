"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { ToolWorkspace, type ToolRenderArgs } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import { compress, PRESETS, type CompressPreset } from "@/engines/compress";
import { cn } from "@/lib/utils";

const PRESET_INFO: { key: CompressPreset; label: string; blurb: string }[] = [
  { key: "light", label: "Light", blurb: "Best quality, modest savings (150 DPI)." },
  { key: "balanced", label: "Balanced", blurb: "Good quality, strong savings (120 DPI)." },
  { key: "strong", label: "Strong", blurb: "Smallest file, lower quality (96 DPI)." },
];

export function CompressTool() {
  const tool = TOOLS_BY_SLUG["compress"]!;
  const runner = useMainThreadRunner();
  const [preset, setPreset] = React.useState<CompressPreset>("balanced");

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return (
      <div className="flex flex-col gap-3">
        <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />
        <div className="grid gap-2 sm:grid-cols-3">
          {PRESET_INFO.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={preset === p.key}
              onClick={() => setPreset(p.key)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border-2 p-3 text-left transition-colors",
                preset === p.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
            >
              <span className="font-medium">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.blurb}</span>
              <span className="mt-1 font-mono text-[10px] text-muted-foreground">
                {PRESETS[p.key].dpi} DPI · q{Math.round(PRESETS[p.key].quality * 100)}
              </span>
            </button>
          ))}
        </div>
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
          This JS compressor rebuilds pages from images, so selectable text
          becomes part of the page image. Great for scans and image-heavy PDFs.
        </p>
      </div>
    );
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const run = async () => {
      const f = files[0];
      if (!f) return;
      const bytes = await fileToBytes(f.file);
      try {
        const res = await runner.run((onProgress, signal) =>
          compress(bytes, preset, onProgress, signal),
        );
        setResult({
          outputs: [
            {
              bytes: res.bytes,
              blob: bytesToPdfBlob(res.bytes),
              filename: f.file.name.replace(/\.pdf$/i, "-compressed.pdf"),
            },
          ],
          inputBytes: f.file.size,
        });
      } catch {
        /* surfaced via runner.error */
      }
    };
    return (
      <>
        <p className="text-sm text-muted-foreground">
          Selected preset: <span className="font-medium">{preset}</span>
        </p>
        <Button onClick={run} disabled={files.length === 0}>
          Compress PDF
        </Button>
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
      renderMain={main}
      renderOptions={options}
    />
  );
}
