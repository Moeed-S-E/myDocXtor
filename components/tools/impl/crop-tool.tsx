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
import { parsePageRanges } from "@/lib/page-ranges";
import { getPageCount } from "@/engines/pdf-lib-ops";
import { toUserMessage } from "@/lib/errors";

export function CropTool() {
  const tool = TOOLS_BY_SLUG["crop"]!;
  const runner = usePdfLibRunner();
  const [top, setTop] = React.useState(0);
  const [right, setRight] = React.useState(0);
  const [bottom, setBottom] = React.useState(0);
  const [left, setLeft] = React.useState(0);
  const [scope, setScope] = React.useState<"all" | "range">("all");
  const [ranges, setRanges] = React.useState("");
  const [pageCount, setPageCount] = React.useState<number | null>(null);
  const [current, setCurrent] = React.useState<LoadedFile | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

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
      setLocalError(null);
      const f = files[0];
      if (!f) return;
      const bytes = await fileToBytes(f.file);
      try {
        let pages: number[] | "all" = "all";
        if (scope === "range") {
          const total = pageCount ?? (await getPageCount(bytes));
          pages = parsePageRanges(ranges, total);
        }
        const out = await runner.run("cropPdf", [bytes, { top, right, bottom, left }, pages]);
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, "-cropped.pdf"),
            },
          ],
          inputBytes: f.file.size,
        });
      } catch (err) {
        setLocalError(toUserMessage(err).title);
      }
    };

    const noMargins = top === 0 && right === 0 && bottom === 0 && left === 0;
    return (
      <>
        <p className="text-sm text-muted-foreground">
          Trim margins from each edge, in points (72 pt = 1 inch).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Top">
            <TextInput type="number" min={0} value={top} onChange={(e) => setTop(Math.max(0, Number(e.target.value)))} />
          </Field>
          <Field label="Right">
            <TextInput type="number" min={0} value={right} onChange={(e) => setRight(Math.max(0, Number(e.target.value)))} />
          </Field>
          <Field label="Bottom">
            <TextInput type="number" min={0} value={bottom} onChange={(e) => setBottom(Math.max(0, Number(e.target.value)))} />
          </Field>
          <Field label="Left">
            <TextInput type="number" min={0} value={left} onChange={(e) => setLeft(Math.max(0, Number(e.target.value)))} />
          </Field>
        </div>
        <Field label="Apply to">
          <Select value={scope} onChange={(e) => setScope(e.target.value as "all" | "range")}>
            <option value="all">All pages</option>
            <option value="range">Selected pages</option>
          </Select>
        </Field>
        {scope === "range" && (
          <Field label="Pages" hint={pageCount ? `of ${pageCount}` : undefined}>
            <TextInput value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 7" inputMode="numeric" />
          </Field>
        )}
        {localError && <p className="text-sm text-danger">{localError}</p>}
        <Button onClick={run} disabled={noMargins || (scope === "range" && !ranges.trim())}>
          Crop PDF
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
      onFilesChange={onFilesChange}
      renderMain={main}
      renderOptions={options}
    />
  );
}
