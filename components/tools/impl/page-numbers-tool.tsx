"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "../controls";
import { ToolWorkspace, type ToolRenderArgs, type LoadedFile } from "../tool-workspace";
import { usePdfLibRunner } from "../use-pdf-lib-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import type { NumberFormat, Corner } from "@/engines/pdf-lib-ops";
import { getPageCount } from "@/engines/pdf-lib-ops";

export function PageNumbersTool() {
  const tool = TOOLS_BY_SLUG["page-numbers"]!;
  const runner = usePdfLibRunner();
  const [format, setFormat] = React.useState<NumberFormat>("n");
  const [position, setPosition] = React.useState<Corner>("bottom-center");
  const [start, setStart] = React.useState(1);
  const [fontSize, setFontSize] = React.useState(12);
  const [pageCount, setPageCount] = React.useState<number | null>(null);
  const [current, setCurrent] = React.useState<LoadedFile | null>(null);

  const onFilesChange = React.useCallback((files: LoadedFile[]) => {
    setCurrent(files[0] ?? null);
  }, []);

  React.useEffect(() => {
    let active = true;
    if (!current) return setPageCount(null);
    (async () => {
      try {
        const n = await getPageCount(await fileToBytes(current.file));
        if (active) setPageCount(n);
      } catch {
        if (active) setPageCount(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [current]);

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return (
      <FileCard
        name={f.file.name}
        size={f.file.size}
        pageCount={pageCount ?? undefined}
        onRemove={() => removeFile(f.id)}
      />
    );
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const run = async () => {
      const f = files[0];
      if (!f) return;
      const bytes = await fileToBytes(f.file);
      try {
        const out = await runner.run("addPageNumbers", [
          bytes,
          { format, position, start, fontSize },
        ]);
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, "-numbered.pdf"),
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
        <Field label="Format">
          <Select value={format} onChange={(e) => setFormat(e.target.value as NumberFormat)}>
            <option value="n">1, 2, 3</option>
            <option value="page-n-of-m">Page 1 of N</option>
            <option value="roman">i, ii, iii</option>
          </Select>
        </Field>
        <Field label="Position">
          <Select value={position} onChange={(e) => setPosition(e.target.value as Corner)}>
            <option value="top-left">Top left</option>
            <option value="top-center">Top center</option>
            <option value="top-right">Top right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="bottom-center">Bottom center</option>
            <option value="bottom-right">Bottom right</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start at">
            <TextInput
              type="number"
              min={0}
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            />
          </Field>
          <Field label="Font size">
            <TextInput
              type="number"
              min={6}
              max={48}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </Field>
        </div>
        <Button onClick={run}>Add page numbers</Button>
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
      onFilesChange={onFilesChange}
      renderMain={main}
      renderOptions={options}
    />
  );
}
