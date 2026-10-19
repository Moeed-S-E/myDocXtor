"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Field, Select } from "../controls";
import { ToolWorkspace, type ToolRenderArgs } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import { ocrPdf } from "@/engines/ocr";

export function OcrTool() {
  const tool = TOOLS_BY_SLUG["ocr"]!;
  const runner = useMainThreadRunner();
  const [accuracy, setAccuracy] = React.useState<"fast" | "accurate">("accurate");

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return (
      <div className="flex flex-col gap-3">
        <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />
        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          OCR runs entirely on your device using a self-hosted recognition
          engine and English language data. An invisible text layer is added so
          the PDF looks the same but becomes searchable and selectable.
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
        const out = await runner.run((onProgress, signal) =>
          ocrPdf(bytes, { lang: "eng", dpi: accuracy === "accurate" ? 300 : 200 }, onProgress, signal),
        );
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, "-searchable.pdf"),
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
        <Field label="Language">
          <Select value="eng" disabled>
            <option value="eng">English</option>
          </Select>
        </Field>
        <Field label="Accuracy" hint="Higher accuracy renders at a higher DPI (slower).">
          <Select
            value={accuracy}
            onChange={(e) => setAccuracy(e.target.value as "fast" | "accurate")}
          >
            <option value="fast">Faster (200 DPI)</option>
            <option value="accurate">More accurate (300 DPI)</option>
          </Select>
        </Field>
        <Button onClick={run} disabled={files.length === 0}>
          Make searchable
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
