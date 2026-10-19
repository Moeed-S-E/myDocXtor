"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { ToolWorkspace, type ToolRenderArgs } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { pdfToWord } from "@/engines/convert/pdf-to-word";
import { ocrToWord } from "@/engines/convert/ocr-variants";
import { Field } from "../controls";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function PdfToWordTool() {
  const tool = TOOLS_BY_SLUG["pdf-to-word"]!;
  const runner = useMainThreadRunner();
  const [ocrFirst, setOcrFirst] = React.useState(false);

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return (
      <div className="flex flex-col gap-3">
        <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
          Produces reflowed, editable text with heading guesses from font sizes.
          Layout, columns, and images may differ from the original.
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
          ocrFirst ? ocrToWord(bytes, onProgress, signal) : pdfToWord(bytes, onProgress, signal),
        );
        const blob = new Blob([out.slice()], { type: DOCX_MIME });
        setResult({
          outputs: [{ bytes: out, blob, filename: f.file.name.replace(/\.pdf$/i, ".docx") }],
          inputBytes: f.file.size,
        });
      } catch {
        /* surfaced via runner.error */
      }
    };
    return (
      <>
        <p className="text-sm text-muted-foreground">Convert this PDF to an editable Word document.</p>
        <Field label="" hint="Turn on for scanned PDFs with no selectable text (slower).">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ocrFirst} onChange={(e) => setOcrFirst(e.target.checked)} />
            Run OCR first (scanned documents)
          </label>
        </Field>
        <Button onClick={run} disabled={files.length === 0}>
          Convert to Word
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
