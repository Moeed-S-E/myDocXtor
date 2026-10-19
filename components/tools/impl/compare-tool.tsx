"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dropzone } from "@/components/file/dropzone";
import { FileCard } from "@/components/file/file-card";
import { cn } from "@/lib/utils";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import {
  compareText,
  compareVisual,
  type TextDiffResult,
  type VisualPageDiff,
} from "@/engines/compare";

type Mode = "text" | "visual";

export function CompareTool() {
  const tool = TOOLS_BY_SLUG["compare"]!;
  const runner = useMainThreadRunner();
  const [fileA, setFileA] = React.useState<File | null>(null);
  const [fileB, setFileB] = React.useState<File | null>(null);
  const [mode, setMode] = React.useState<Mode>("text");
  const [textResult, setTextResult] = React.useState<TextDiffResult | null>(null);
  const [visualResult, setVisualResult] = React.useState<VisualPageDiff[] | null>(null);

  const Icon = tool.icon;

  const run = async () => {
    if (!fileA || !fileB) return;
    setTextResult(null);
    setVisualResult(null);
    const a = await fileToBytes(fileA);
    const b = await fileToBytes(fileB);
    try {
      if (mode === "text") {
        const res = await runner.run((onProgress) => compareText(a, b, onProgress));
        setTextResult(res);
      } else {
        const res = await runner.run((onProgress, signal) =>
          compareVisual(a, b, {}, onProgress, signal),
        );
        setVisualResult(res);
      }
    } catch {
      /* surfaced via runner.error */
    }
  };

  const reset = () => {
    setFileA(null);
    setFileB(null);
    setTextResult(null);
    setVisualResult(null);
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

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FilePicker label="Original (A)" file={fileA} onPick={setFileA} />
            <FilePicker label="Changed (B)" file={fileB} onPick={setFileB} />
          </div>

          {textResult && (
            <div className="rounded-md border border-border bg-card p-4">
              <p className="mb-2 text-sm">
                {textResult.changed ? (
                  <>
                    <span className="font-medium text-success">+{textResult.insertions}</span>{" "}
                    added,{" "}
                    <span className="font-medium text-danger">-{textResult.deletions}</span>{" "}
                    removed (characters).
                  </>
                ) : (
                  <span className="text-muted-foreground">No text differences found.</span>
                )}
              </p>
              <div className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                {textResult.segments.map((s, i) => (
                  <span
                    key={i}
                    className={cn(
                      s.op === "insert" && "bg-success/20 text-success",
                      s.op === "delete" && "bg-danger/20 text-danger line-through",
                    )}
                  >
                    {s.text}
                  </span>
                ))}
              </div>
            </div>
          )}

          {visualResult && (
            <div className="flex flex-col gap-4">
              {visualResult.map((v) => {
                const pct = ((v.changedPixels / v.totalPixels) * 100).toFixed(2);
                return (
                  <div key={v.pageNumber} className="rounded-md border border-border bg-card p-3">
                    <p className="mb-2 font-mono text-xs text-muted-foreground">
                      Page {v.pageNumber}: {v.changedPixels} changed px ({pct}%)
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(v.diffBlob)}
                      alt={`Visual diff of page ${v.pageNumber}`}
                      className="w-full rounded border border-border bg-white"
                    />
                  </div>
                );
              })}
              {visualResult.length === 0 && (
                <p className="text-sm text-muted-foreground">No comparable pages.</p>
              )}
            </div>
          )}
        </div>

        <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-4">
          {runner.status === "running" ? (
            <Progress value={runner.progress.value} label={runner.progress.label} onCancel={runner.cancel} />
          ) : (
            <>
              <div className="flex gap-1 rounded-md bg-muted p-1">
                {(["text", "visual"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={cn(
                      "flex-1 rounded px-2 py-1.5 text-xs capitalize transition-colors",
                      mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {m === "text" ? "Text diff" : "Visual overlay"}
                  </button>
                ))}
              </div>
              <Button onClick={run} disabled={!fileA || !fileB}>
                Compare
              </Button>
              <Button variant="ghost" onClick={reset}>
                Reset
              </Button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function FilePicker({
  label,
  file,
  onPick,
}: {
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {file ? (
        <FileCard name={file.name} size={file.size} onRemove={() => onPick(null)} />
      ) : (
        <Dropzone
          accept={["pdf"]}
          multiple={false}
          onFiles={(files) => files[0] && onPick(files[0])}
          className="py-8"
        />
      )}
    </div>
  );
}
