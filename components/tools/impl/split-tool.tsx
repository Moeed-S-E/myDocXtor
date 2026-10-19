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
import { getPageCount, type SplitMode } from "@/engines/pdf-lib-ops";
import { toUserMessage } from "@/lib/errors";

export function SplitTool() {
  const tool = TOOLS_BY_SLUG["split"]!;
  const runner = usePdfLibRunner();
  const [mode, setMode] = React.useState<"everyN" | "ranges">("everyN");
  const [n, setN] = React.useState(1);
  const [rangeText, setRangeText] = React.useState("");
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
        const count = await getPageCount(await fileToBytes(current.file));
        if (active) setPageCount(count);
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
        const total = pageCount ?? (await getPageCount(bytes));
        let splitMode: SplitMode;
        if (mode === "everyN") {
          splitMode = { kind: "everyN", n };
        } else {
          // Each comma-separated group becomes one output; "-" denotes a span.
          const groups = rangeText
            .split(/[;\n]+/)
            .map((g) => g.trim())
            .filter(Boolean)
            .map((g) => parsePageRanges(g, total));
          splitMode = { kind: "ranges", ranges: groups };
        }
        const outs = await runner.run("splitPdf", [bytes, splitMode]);
        const base = f.file.name.replace(/\.pdf$/i, "");
        setResult({
          outputs: outs.map((bytes, i) => ({
            bytes,
            blob: bytesToPdfBlob(bytes),
            filename: `${base}-part-${i + 1}.pdf`,
          })),
          inputBytes: f.file.size,
        });
      } catch (err) {
        setLocalError(toUserMessage(err).title);
      }
    };

    return (
      <>
        <Field label="Split by">
          <Select value={mode} onChange={(e) => setMode(e.target.value as "everyN" | "ranges")}>
            <option value="everyN">Every N pages</option>
            <option value="ranges">Custom ranges</option>
          </Select>
        </Field>
        {mode === "everyN" ? (
          <Field label="Pages per file" hint={pageCount ? `document has ${pageCount} pages` : undefined}>
            <TextInput
              type="number"
              min={1}
              value={n}
              onChange={(e) => setN(Math.max(1, Number(e.target.value)))}
            />
          </Field>
        ) : (
          <Field
            label="Ranges (one output per line)"
            hint="e.g. 1-3 then 4-8 on separate lines"
          >
            <textarea
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              rows={4}
              placeholder={"1-3\n4-8\n9-12"}
              className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        )}
        {localError && <p className="text-sm text-danger">{localError}</p>}
        <Button onClick={run} disabled={mode === "ranges" && !rangeText.trim()}>
          Split PDF
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
