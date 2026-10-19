"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "../controls";
import { ToolWorkspace, type ToolRenderArgs, type LoadedFile } from "../tool-workspace";
import { usePdfLibRunner } from "../use-pdf-lib-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import { parsePageRanges } from "@/lib/page-ranges";
import { getPageCount } from "@/engines/pdf-lib-ops";
import { toUserMessage } from "@/lib/errors";

type Mode = "extract" | "remove";

function RangeTool({ mode }: { mode: Mode }) {
  const tool = TOOLS_BY_SLUG[mode === "extract" ? "extract-pages" : "remove-pages"]!;
  const runner = usePdfLibRunner();
  const [ranges, setRanges] = React.useState("");
  const [pageCount, setPageCount] = React.useState<number | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [current, setCurrent] = React.useState<LoadedFile | null>(null);

  // Top-level effect: compute page count whenever the selected file changes.
  const onFilesChange = React.useCallback((files: LoadedFile[]) => {
    setCurrent(files[0] ?? null);
  }, []);

  React.useEffect(() => {
    let active = true;
    if (!current) {
      setPageCount(null);
      return;
    }
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
        const total = pageCount ?? (await getPageCount(bytes));
        const pages = parsePageRanges(ranges, total);
        const method = mode === "extract" ? "extractPages" : "removePages";
        const out = await runner.run(method, [bytes, pages]);
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, `-${mode}.pdf`),
            },
          ],
          inputBytes: f.file.size,
        });
      } catch (err) {
        setLocalError(toUserMessage(err).title);
      }
    };

    return (
      <>
        <Field
          label={mode === "extract" ? "Pages to extract" : "Pages to remove"}
          hint={pageCount ? `e.g. 1-3, 7, 9-12 (of ${pageCount})` : "e.g. 1-3, 7, 9-12"}
        >
          <TextInput
            value={ranges}
            onChange={(e) => setRanges(e.target.value)}
            placeholder="1-3, 7, 9-12"
            inputMode="numeric"
          />
        </Field>
        {localError && <p className="text-sm text-danger">{localError}</p>}
        <Button onClick={run} disabled={!ranges.trim()}>
          {tool.name}
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

export function ExtractPagesTool() {
  return <RangeTool mode="extract" />;
}
export function RemovePagesTool() {
  return <RangeTool mode="remove" />;
}
