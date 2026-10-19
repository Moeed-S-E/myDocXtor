"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateFile, formatBytes, MAX_FILE_BYTES } from "@/lib/files";
import { toUserMessage } from "@/lib/errors";

export interface DropzoneProps {
  /** Which input types this tool accepts. */
  accept: ("pdf" | "image")[];
  /** Allow selecting more than one file. */
  multiple?: boolean;
  /** Called with files that passed magic-byte validation. */
  onFiles: (files: File[]) => void;
  /** Called with per-file validation errors. */
  onErrors?: (errors: { file: string; message: string }[]) => void;
  className?: string;
}

const ACCEPT_HINT: Record<"pdf" | "image", string> = {
  pdf: "PDF",
  image: "JPG, PNG, WebP, HEIC",
};

/**
 * Accepts drag, click, and paste. Validates immediately by magic bytes, not
 * extension (UI steering §3.4; design §5.1). Errors are reported inline per
 * file via `onErrors`.
 */
export function Dropzone({
  accept,
  multiple = true,
  onFiles,
  onErrors,
  className,
}: DropzoneProps) {
  const [isOver, setIsOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handle = React.useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const accepted: File[] = [];
      const errors: { file: string; message: string }[] = [];
      for (const file of files) {
        try {
          await validateFile(file, accept);
          accepted.push(file);
        } catch (err) {
          errors.push({ file: file.name, message: toUserMessage(err).title });
        }
      }
      if (accepted.length) onFiles(multiple ? accepted : accepted.slice(0, 1));
      if (errors.length) onErrors?.(errors);
    },
    [accept, multiple, onFiles, onErrors],
  );

  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      void handle(e.clipboardData.files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handle]);

  const hint = accept.map((a) => ACCEPT_HINT[a]).join(", ");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors duration-175 ease-out-soft",
        isOver && "border-primary bg-primary/5",
        className,
      )}
      role="button"
      tabIndex={0}
      aria-label="Choose files or drop them here"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        void handle(e.dataTransfer.files);
      }}
    >
      <UploadCloud className="size-10 text-muted-foreground" />
      <p className="text-base font-medium">Choose files or drop them here</p>
      <p className="text-sm text-muted-foreground">
        {hint || "Any file"} · up to {formatBytes(MAX_FILE_BYTES)} · paste from clipboard
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) void handle(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
