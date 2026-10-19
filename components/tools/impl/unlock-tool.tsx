"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "../controls";
import { ToolWorkspace, type ToolRenderArgs } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import { unlockPdf } from "@/engines/protect";

export function UnlockTool() {
  const tool = TOOLS_BY_SLUG["unlock"]!;
  const runner = useMainThreadRunner();
  const [password, setPassword] = React.useState("");

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return (
      <div className="flex flex-col gap-3">
        <FileCard name={f.file.name} size={f.file.size} locked onRemove={() => removeFile(f.id)} />
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
          Enter the password you already know — we never guess or crack
          passwords. To strip encryption with only MIT-licensed tools, each page
          is rebuilt as an image, so selectable text becomes part of the page.
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
          unlockPdf(bytes, password, onProgress, signal),
        );
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, "-unlocked.pdf"),
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
        <Field label="Current password">
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button onClick={run} disabled={files.length === 0 || !password}>
          Remove password
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
