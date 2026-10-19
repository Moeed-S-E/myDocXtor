"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { ToolWorkspace, type ToolRenderArgs, type LoadedFile } from "../tool-workspace";
import { usePdfLibRunner } from "../use-pdf-lib-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import { readMetadata } from "@/engines/pdf-lib-ops";

export function CopyTool() {
  const tool = TOOLS_BY_SLUG["copy"]!;
  const runner = usePdfLibRunner();
  const [strip, setStrip] = React.useState(false);
  const [current, setCurrent] = React.useState<LoadedFile | null>(null);
  const [meta, setMeta] = React.useState<Record<string, string> | null>(null);

  const onFilesChange = React.useCallback((files: LoadedFile[]) => {
    setCurrent(files[0] ?? null);
  }, []);

  React.useEffect(() => {
    let active = true;
    if (!current) return setMeta(null);
    (async () => {
      try {
        const m = await readMetadata(await fileToBytes(current.file));
        if (active) setMeta(m);
      } catch {
        if (active) setMeta(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [current]);

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    const entries = meta ? Object.entries(meta).filter(([, v]) => v) : [];
    return (
      <div className="flex flex-col gap-3">
        <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />
        <div className="rounded-md border border-border bg-card p-4 text-sm">
          <p className="mb-2 font-medium">Metadata</p>
          {entries.length === 0 ? (
            <p className="text-muted-foreground">No metadata found (or already clean).</p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {entries.map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="font-mono text-xs capitalize text-muted-foreground">{k}</dt>
                  <dd className="truncate">{v}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </div>
      </div>
    );
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const run = async () => {
      const f = files[0];
      if (!f) return;
      const bytes = await fileToBytes(f.file);
      try {
        const out = await runner.run("copyPdf", [bytes, { stripMetadata: strip }]);
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, "-copy.pdf"),
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={strip} onChange={(e) => setStrip(e.target.checked)} />
          Clean metadata (title, author, dates, etc.)
        </label>
        <Button onClick={run} disabled={files.length === 0}>
          Make a copy
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
