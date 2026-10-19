"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Field, Select } from "../controls";
import { ToolWorkspace, type ToolRenderArgs } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { renderPages } from "@/engines/render";

export function PdfToJpgTool() {
  const tool = TOOLS_BY_SLUG["pdf-to-jpg"]!;
  const runner = useMainThreadRunner();
  const [dpi, setDpi] = React.useState(150);

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />;
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const run = async () => {
      const f = files[0];
      if (!f) return;
      const bytes = await fileToBytes(f.file);
      try {
        const rendered = await runner.run((onProgress, signal) =>
          renderPages(bytes, { dpi, format: "image/jpeg", quality: 0.9 }, onProgress, signal),
        );
        const base = f.file.name.replace(/\.pdf$/i, "");
        const outputs = await Promise.all(
          rendered.map(async (r) => {
            const bytes = new Uint8Array(await r.blob.arrayBuffer());
            return {
              bytes,
              blob: r.blob,
              filename: `${base}-page-${String(r.pageNumber).padStart(3, "0")}.jpg`,
            };
          }),
        );
        setResult({ outputs, inputBytes: f.file.size });
      } catch {
        /* surfaced via runner.error */
      }
    };

    return (
      <>
        <Field label="Resolution (DPI)" hint="Higher DPI = sharper, larger files.">
          <Select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
            <option value={72}>72 (screen)</option>
            <option value={150}>150 (good)</option>
            <option value={200}>200 (high)</option>
            <option value={300}>300 (print)</option>
          </Select>
        </Field>
        <Button onClick={run} disabled={files.length === 0}>
          Convert to JPG
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
