"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { ToolWorkspace, type ToolRenderArgs } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { pdfToExcel } from "@/engines/convert/pdf-to-excel";
import { ocrToExcel } from "@/engines/convert/ocr-variants";
import { Field } from "../controls";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function PdfToExcelTool() {
  const tool = TOOLS_BY_SLUG["pdf-to-excel"]!;
  const runner = useMainThreadRunner();
  const [ocrFirst, setOcrFirst] = React.useState(false);

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return (
      <div className="flex flex-col gap-3">
        <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
          Reflows each page&apos;s text into rows and columns (one sheet per
          page). Best-effort — complex tables may need manual cleanup.
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
          ocrFirst ? ocrToExcel(bytes, onProgress, signal) : pdfToExcel(bytes, onProgress, signal),
        );
        const blob = new Blob([out.slice()], { type: XLSX_MIME });
        setResult({
          outputs: [{ bytes: out, blob, filename: f.file.name.replace(/\.pdf$/i, ".xlsx") }],
          inputBytes: f.file.size,
        });
      } catch {
        /* surfaced via runner.error */
      }
    };
    return (
      <>
        <p className="text-sm text-muted-foreground">Convert this PDF to a spreadsheet.</p>
        <Field label="" hint="Turn on for scanned PDFs with no selectable text (slower).">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ocrFirst} onChange={(e) => setOcrFirst(e.target.checked)} />
            Run OCR first (scanned documents)
          </label>
        </Field>
        <Button onClick={run} disabled={files.length === 0}>
          Convert to Excel
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
