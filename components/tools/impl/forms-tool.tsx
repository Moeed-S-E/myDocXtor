"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Select, TextInput } from "../controls";
import { ToolWorkspace, type ToolRenderArgs, type LoadedFile } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import { listFields, fillForm, type FormField, type FillValues } from "@/engines/forms";

export function FormsTool() {
  const tool = TOOLS_BY_SLUG["forms"]!;
  const runner = useMainThreadRunner();
  const [current, setCurrent] = React.useState<LoadedFile | null>(null);
  const [fields, setFields] = React.useState<FormField[]>([]);
  const [values, setValues] = React.useState<FillValues>({});
  const [flatten, setFlatten] = React.useState(false);
  const [noFields, setNoFields] = React.useState(false);

  const onFilesChange = React.useCallback((files: LoadedFile[]) => {
    setCurrent(files[0] ?? null);
  }, []);

  React.useEffect(() => {
    let active = true;
    if (!current) {
      setFields([]);
      setValues({});
      setNoFields(false);
      return;
    }
    (async () => {
      try {
        const list = await listFields(await fileToBytes(current.file));
        if (!active) return;
        setFields(list);
        setNoFields(list.length === 0);
        const init: FillValues = {};
        for (const f of list) if (f.value !== undefined) init[f.name] = f.value;
        setValues(init);
      } catch {
        if (active) setFields([]);
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
        <FileCard name={f.file.name} size={f.file.size} onRemove={() => removeFile(f.id)} />
        {noFields && (
          <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-muted-foreground">
            This PDF has no fillable form fields.
          </p>
        )}
        {fields.length > 0 && (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
            {fields.map((field) => (
              <label key={field.name} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {field.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">({field.kind})</span>
                </span>
                {field.kind === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={Boolean(values[field.name])}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.checked }))}
                    className="size-4 self-start"
                  />
                ) : (field.kind === "radio" || field.kind === "dropdown") && field.options ? (
                  <Select
                    value={String(values[field.name] ?? "")}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  >
                    <option value="">—</option>
                    {field.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <TextInput
                    value={String(values[field.name] ?? "")}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  />
                )}
              </label>
            ))}
          </div>
        )}
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
          fillForm(bytes, values, flatten, onProgress, signal),
        );
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, flatten ? "-filled-flat.pdf" : "-filled.pdf"),
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
          <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} />
          Flatten (make values non-editable)
        </label>
        <Button onClick={run} disabled={fields.length === 0}>
          {flatten ? "Fill & flatten" : "Fill form"}
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
