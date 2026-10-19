"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import type { ToolDef } from "@/lib/tools";
import { Dropzone } from "@/components/file/dropzone";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ResultPanel, type ResultOutput } from "./result-panel";
import type { RunStatus } from "./use-pdf-lib-runner";
import type { Progress as ProgressState } from "@/workers/types";

export interface LoadedFile {
  file: File;
  id: string;
}

export interface ToolRenderArgs {
  files: LoadedFile[];
  setFiles: React.Dispatch<React.SetStateAction<LoadedFile[]>>;
  removeFile: (id: string) => void;
  setResult: (r: { outputs: ResultOutput[]; inputBytes: number } | null) => void;
}

interface ToolWorkspaceProps {
  tool: ToolDef;
  multiple?: boolean;
  status: RunStatus;
  progress: ProgressState;
  error: { title: string; nextStep: string } | null;
  onCancel: () => void;
  onReset: () => void;
  /** Renders the main (left) area: file list / thumbnails. */
  renderMain: (args: ToolRenderArgs) => React.ReactNode;
  /** Renders the right-hand options panel + primary action button. */
  renderOptions: (args: ToolRenderArgs) => React.ReactNode;
  /** Notified whenever the loaded files change (for top-level effects). */
  onFilesChange?: (files: LoadedFile[]) => void;
}

/** Shared chrome + three-state flow for every pdf-lib tool (UI steering §3.3). */
export function ToolWorkspace({
  tool,
  multiple = false,
  status,
  progress,
  error,
  onCancel,
  onReset,
  renderMain,
  renderOptions,
  onFilesChange,
}: ToolWorkspaceProps) {
  const [files, setFiles] = React.useState<LoadedFile[]>([]);
  const [fileErrors, setFileErrors] = React.useState<{ file: string; message: string }[]>([]);
  const [result, setResult] = React.useState<{
    outputs: ResultOutput[];
    inputBytes: number;
  } | null>(null);
  React.useEffect(() => {
    onFilesChange?.(files);
  }, [files, onFilesChange]);
  const Icon = tool.icon;
  const accept = tool.accepts.length ? tool.accepts : (["pdf"] as ("pdf" | "image")[]);

  const addFiles = (incoming: File[]) => {
    setFileErrors([]);
    setFiles((prev) => {
      const next = incoming.map((file) => ({ file, id: crypto.randomUUID() }));
      return multiple ? [...prev, ...next] : next.slice(0, 1);
    });
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const startOver = () => {
    setFiles([]);
    setFileErrors([]);
    setResult(null);
    onReset();
  };

  const args: ToolRenderArgs = { files, setFiles, removeFile, setResult };
  const running = status === "running";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to all tools">
          <Link href="/app/">
            <ArrowLeft />
          </Link>
        </Button>
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold">{tool.name}</h1>
          <p className="text-sm text-muted-foreground">{tool.description}</p>
        </div>
      </div>

      {fileErrors.length > 0 && (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-1 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm"
        >
          {fileErrors.map((e, i) => (
            <p key={i} className="flex items-center gap-2 text-danger">
              <AlertCircle className="size-4 shrink-0" />
              <span className="font-medium">{e.file}:</span> {e.message}
            </p>
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm"
        >
          <p className="font-medium text-danger">{error.title}</p>
          <p className="text-muted-foreground">{error.nextStep}</p>
        </div>
      )}

      {result ? (
        <ResultPanel
          outputs={result.outputs}
          inputBytes={result.inputBytes}
          zipName={`${tool.slug}-output.zip`}
          onStartOver={startOver}
        />
      ) : files.length === 0 ? (
        <Dropzone accept={accept} multiple={multiple} onFiles={addFiles} onErrors={setFileErrors} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            {renderMain(args)}
            {multiple && (
              <Dropzone
                accept={accept}
                multiple
                onFiles={addFiles}
                onErrors={setFileErrors}
                className="py-6"
              />
            )}
          </div>
          <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-4">
            {running ? (
              <Progress value={progress.value} label={progress.label} onCancel={onCancel} />
            ) : (
              renderOptions(args)
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

/** Default main-area renderer: a simple list of file cards. */
export function FileList({ files, removeFile }: ToolRenderArgs) {
  return (
    <div className="flex flex-col gap-2">
      {files.map(({ file, id }) => (
        <FileCard key={id} name={file.name} size={file.size} onRemove={() => removeFile(id)} />
      ))}
    </div>
  );
}
