"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { ToolWorkspace, type ToolRenderArgs } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { pdfToPowerPoint } from "@/engines/convert/pdf-to-ppt";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export function PdfToPptTool() {
  const tool = TOOLS_BY_SLUG["pdf-to-ppt"]!;
  const runner = useMainThreadRunner();

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return (
      <div className="flex flex-col gap-3">
        <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />
        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Each page becomes one slide with the page rendered as the slide image.
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
        const out = await runner.run((onProgress, signal) => pdfToPowerPoint(bytes, onProgress, signal));
        const blob = new Blob([out.slice()], { type: PPTX_MIME });
        setResult({
          outputs: [{ bytes: out, blob, filename: f.file.name.replace(/\.pdf$/i, ".pptx") }],
          inputBytes: f.file.size,
        });
      } catch {
        /* surfaced via runner.error */
      }
    };
    return (
      <>
        <p className="text-sm text-muted-foreground">Convert each page to a slide.</p>
        <Button onClick={run} disabled={files.length === 0}>
          Convert to PowerPoint
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
