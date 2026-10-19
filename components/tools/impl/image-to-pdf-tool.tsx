"use client";

import * as React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "../controls";
import { ToolWorkspace, type ToolRenderArgs } from "../tool-workspace";
import { usePdfLibRunner } from "../use-pdf-lib-runner";
import { fileToBytes, imageKind } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import type { PageSizeName } from "@/engines/pdf-lib-ops";
import { AppError, toUserMessage } from "@/lib/errors";

export function ImageToPdfTool() {
  const tool = TOOLS_BY_SLUG["image-to-pdf"]!;
  const runner = usePdfLibRunner();
  const [pageSize, setPageSize] = React.useState<PageSizeName>("fit");
  const [landscape, setLandscape] = React.useState(false);
  const [margin, setMargin] = React.useState(24);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const main = ({ files, setFiles, removeFile }: ToolRenderArgs) => {
    const move = (idx: number, dir: -1 | 1) =>
      setFiles((prev) => {
        const next = [...prev];
        const j = idx + dir;
        if (j < 0 || j >= next.length) return prev;
        [next[idx], next[j]] = [next[j]!, next[idx]!];
        return next;
      });
    return (
      <div className="flex flex-col gap-2">
        {files.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2">
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-6"
                aria-label={`Move ${item.file.name} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-6"
                aria-label={`Move ${item.file.name} down`}
                disabled={i === files.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown className="size-3" />
              </Button>
            </div>
            <div className="flex-1">
              <FileCard name={item.file.name} size={item.file.size} onRemove={() => removeFile(item.id)} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const run = async () => {
      setLocalError(null);
      try {
        const images = [];
        for (const item of files) {
          const kind = await imageKind(item.file);
          if (!kind) {
            throw new AppError(
              "UnsupportedFeature",
              `${item.file.name}: only JPG and PNG are supported for now (HEIC/WebP conversion lands later).`,
            );
          }
          images.push({ bytes: await fileToBytes(item.file), type: kind });
        }
        const inputBytes = files.reduce((s, f) => s + f.file.size, 0);
        const out = await runner.run("imagesToPdf", [images, { pageSize, margin, landscape }]);
        setResult({
          outputs: [{ bytes: out, blob: bytesToPdfBlob(out), filename: "images.pdf" }],
          inputBytes,
        });
      } catch (err) {
        setLocalError(toUserMessage(err).title);
      }
    };

    return (
      <>
        <Field label="Page size">
          <Select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSizeName)}>
            <option value="fit">Fit to image</option>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </Select>
        </Field>
        {pageSize !== "fit" && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={landscape}
                onChange={(e) => setLandscape(e.target.checked)}
              />
              Landscape
            </label>
            <Field label="Margin (pt)">
              <TextInput
                type="number"
                min={0}
                value={margin}
                onChange={(e) => setMargin(Math.max(0, Number(e.target.value)))}
              />
            </Field>
          </>
        )}
        {localError && <p className="text-sm text-danger">{localError}</p>}
        <Button onClick={run} disabled={files.length === 0}>
          Create PDF
        </Button>
      </>
    );
  };

  return (
    <ToolWorkspace
      tool={tool}
      multiple
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
