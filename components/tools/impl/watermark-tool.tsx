"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "../controls";
import { ToolWorkspace, type ToolRenderArgs } from "../tool-workspace";
import { usePdfLibRunner } from "../use-pdf-lib-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";

export function WatermarkTool() {
  const tool = TOOLS_BY_SLUG["watermark"]!;
  const runner = usePdfLibRunner();
  const [text, setText] = React.useState("CONFIDENTIAL");
  const [opacity, setOpacity] = React.useState(0.2);
  const [rotation, setRotation] = React.useState(45);
  const [fontSize, setFontSize] = React.useState(48);
  const [tile, setTile] = React.useState(false);

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />;
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const run = async () => {
      const f = files[0];
      if (!f) return;
      const bytes = await fileToBytes(f.file);
      try {
        const out = await runner.run("addWatermark", [
          bytes,
          { text, opacity, rotationDegrees: rotation, fontSize, tile },
        ]);
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, "-watermarked.pdf"),
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
        <Field label="Watermark text">
          <TextInput value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label={`Opacity: ${Math.round(opacity * 100)}%`}>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            aria-label="Opacity"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rotation°">
            <TextInput
              type="number"
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
            />
          </Field>
          <Field label="Font size">
            <TextInput
              type="number"
              min={8}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tile} onChange={(e) => setTile(e.target.checked)} />
          Tile across the page
        </label>
        <Button onClick={run} disabled={!text.trim()}>
          Add watermark
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
