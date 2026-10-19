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
import { protectPdf, type ProtectPermissions } from "@/engines/protect";

export function ProtectTool() {
  const tool = TOOLS_BY_SLUG["protect"]!;
  const runner = useMainThreadRunner();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [perms, setPerms] = React.useState<ProtectPermissions>({
    printing: true,
    copying: true,
    modifying: false,
    annotating: true,
  });
  const [localError, setLocalError] = React.useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />;
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const run = async () => {
      setLocalError(null);
      const f = files[0];
      if (!f) return;
      if (password !== confirm) {
        setLocalError("Passwords don't match.");
        return;
      }
      const bytes = await fileToBytes(f.file);
      try {
        const out = await runner.run((onProgress, signal) =>
          protectPdf(bytes, { userPassword: password, permissions: perms }, onProgress, signal),
        );
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, "-protected.pdf"),
            },
          ],
          inputBytes: f.file.size,
        });
      } catch {
        /* surfaced via runner.error */
      }
    };

    const toggle = (k: keyof ProtectPermissions) =>
      setPerms((p) => ({ ...p, [k]: !p[k] }));

    return (
      <>
        <Field label="Password">
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password">
          <TextInput type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {mismatch && <p className="text-sm text-danger">Passwords don&apos;t match.</p>}
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-1 font-medium">Allow</legend>
          {(
            [
              ["printing", "Printing"],
              ["copying", "Copying text/images"],
              ["modifying", "Editing content"],
              ["annotating", "Comments & form fill"],
            ] as [keyof ProtectPermissions, string][]
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={perms[k]} onChange={() => toggle(k)} />
              {label}
            </label>
          ))}
        </fieldset>
        {localError && <p className="text-sm text-danger">{localError}</p>}
        <Button onClick={run} disabled={files.length === 0 || !password || mismatch}>
          Protect with AES-256
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
