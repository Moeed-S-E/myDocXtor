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
import { getPageCount } from "@/engines/pdf-lib-ops";
import { SignaturePad } from "./signature-pad";

import { dataUrlToBytes } from "@/lib/data-url";

export function SignTool() {
  const tool = TOOLS_BY_SLUG["sign"]!;
  const runner = usePdfLibRunner();
  const [sig, setSig] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageCount, setPageCount] = React.useState<number | null>(null);
  const [current, setCurrent] = React.useState<LoadedFile | null>(null);
  const [x, setX] = React.useState(360);
  const [y, setY] = React.useState(680);
  const [width, setWidth] = React.useState(180);
  const [height, setHeight] = React.useState(60);

  const onFilesChange = React.useCallback((files: LoadedFile[]) => {
    setCurrent(files[0] ?? null);
  }, []);

  React.useEffect(() => {
    let active = true;
    if (!current) return setPageCount(null);
    (async () => {
      try {
        const n = await getPageCount(await fileToBytes(current.file));
        if (active) {
          setPageCount(n);
          setPage((p) => Math.min(p, n));
        }
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
      <div className="flex flex-col gap-3">
        <FileCard
          name={f.file.name}
          size={f.file.size}
          pageCount={pageCount ?? undefined}
          onRemove={() => removeFile(f.id)}
        />
        <SignaturePad onChange={setSig} />
        {sig && (
          <div className="flex items-center gap-2 text-sm text-success">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sig} alt="Signature preview" className="h-12 rounded border border-border bg-white" />
            Signature ready
          </div>
        )}
      </div>
    );
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const run = async () => {
      const f = files[0];
      if (!f || !sig) return;
      const pdfBytes = await fileToBytes(f.file);
      const png = dataUrlToBytes(sig);
      try {
        const out = await runner.run("signPdf", [
          pdfBytes,
          png,
          { page, x, y, width, height },
        ]);
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, "-signed.pdf"),
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
        <Field label="Page" hint={pageCount ? `of ${pageCount}` : undefined}>
          <TextInput
            type="number"
            min={1}
            max={pageCount ?? undefined}
            value={page}
            onChange={(e) => setPage(Math.max(1, Number(e.target.value)))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="X (pt)">
            <TextInput type="number" value={x} onChange={(e) => setX(Number(e.target.value))} />
          </Field>
          <Field label="Y from top (pt)">
            <TextInput type="number" value={y} onChange={(e) => setY(Number(e.target.value))} />
          </Field>
          <Field label="Width (pt)">
            <TextInput type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          </Field>
          <Field label="Height (pt)">
            <TextInput type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
          </Field>
        </div>
        <Button onClick={run} disabled={!sig || files.length === 0}>
          Sign PDF
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
