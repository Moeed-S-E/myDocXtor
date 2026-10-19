"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Field, Select } from "../controls";
import { ToolWorkspace, type ToolRenderArgs } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { pdfToMarkdown } from "@/engines/convert/pdf-to-text";

export function PdfToMarkdownTool() {
  const tool = TOOLS_BY_SLUG["pdf-to-markdown"]!;
  const runner = useMainThreadRunner();
  const [format, setFormat] = React.useState<"md" | "txt">("md");

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return (
      <div className="flex flex-col gap-3">
        <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
          Output is reflowed text with heading guesses from font sizes. Layout,
          columns, and tables may differ from the original.
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
          pdfToMarkdown(bytes, onProgress, signal),
        );
        const content = format === "md" ? res.markdown : res.text;
        const mime = format === "md" ? "text/markdown" : "text/plain";
        const blob = new Blob([content], { type: mime });
        const outBytes = new Uint8Array(await blob.arrayBuffer());
        setResult({
          outputs: [
            {
              bytes: outBytes,
              blob,
              filename: f.file.name.replace(/\.pdf$/i, `.${format}`),
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
        <Field label="Output format">
          <Select value={format} onChange={(e) => setFormat(e.target.value as "md" | "txt")}>
            <option value="md">Markdown (.md)</option>
            <option value="txt">Plain text (.txt)</option>
          </Select>
        </Field>
        <Button onClick={run} disabled={files.length === 0}>
          Convert to {format === "md" ? "Markdown" : "text"}
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
