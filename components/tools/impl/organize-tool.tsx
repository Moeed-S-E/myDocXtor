"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, RotateCw } from "lucide-react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { ToolWorkspace, type ToolRenderArgs, type LoadedFile } from "../tool-workspace";
import { usePdfLibRunner } from "../use-pdf-lib-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import { getPageCount } from "@/engines/pdf-lib-ops";

/**
 * Organize pages: reorder via move up/down (keyboard alternative to DnD per
 * R-A11Y-1). `order` holds the current 1-based permutation of source pages.
 */
export function OrganizeTool() {
  const tool = TOOLS_BY_SLUG["organize"]!;
  const runner = usePdfLibRunner();
  const [order, setOrder] = React.useState<number[]>([]);
  const [current, setCurrent] = React.useState<LoadedFile | null>(null);

  const onFilesChange = React.useCallback((files: LoadedFile[]) => {
    setCurrent(files[0] ?? null);
  }, []);

  React.useEffect(() => {
    let active = true;
    if (!current) {
      setOrder([]);
      return;
    }
    (async () => {
      try {
        const n = await getPageCount(await fileToBytes(current.file));
        if (active) setOrder(Array.from({ length: n }, (_, i) => i + 1));
      } catch {
        if (active) setOrder([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [current]);

  const move = (idx: number, dir: -1 | 1) => {
    setOrder((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });
  };

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return (
      <div className="flex flex-col gap-3">
        <FileCard
          name={f.file.name}
          size={f.file.size}
          pageCount={order.length || undefined}
          onRemove={() => removeFile(f.id)}
        />
        <ol className="flex flex-col gap-1" aria-label="Page order">
          {order.map((page, idx) => (
            <li
              key={`${page}-${idx}`}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground">#{idx + 1}</span>
              <span className="flex-1">Original page {page}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Move page ${page} up`}
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Move page ${page} down`}
                disabled={idx === order.length - 1}
                onClick={() => move(idx, 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
            </li>
          ))}
        </ol>
      </div>
    );
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const unchanged = order.every((p, i) => p === i + 1);
    const run = async () => {
      const f = files[0];
      if (!f) return;
      const bytes = await fileToBytes(f.file);
      try {
        const out = await runner.run("reorderPages", [bytes, order]);
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, "-organized.pdf"),
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
        <p className="text-sm text-muted-foreground">
          Use the arrows to reorder pages, then save.
        </p>
        <Button
          variant="outline"
          onClick={() => setOrder((prev) => [...prev].sort((a, b) => a - b))}
          disabled={unchanged}
        >
          <RotateCw /> Reset order
        </Button>
        <Button onClick={run} disabled={order.length === 0}>
          Save organized PDF
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
