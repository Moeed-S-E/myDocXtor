"use client";

import * as React from "react";
import { CheckCircle2, Download, Package, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/files";
import { downloadBlob, zipFiles } from "@/lib/download";

export interface ResultOutput {
  bytes: Uint8Array;
  blob: Blob;
  /** Suggested filename (editable for single outputs). */
  filename: string;
}

interface ResultPanelProps {
  outputs: ResultOutput[];
  /** Total input size for the before/after readout. */
  inputBytes: number;
  /** Base name used for the ZIP file. */
  zipName?: string;
  onStartOver: () => void;
}

/** Success panel shown after an engine run (UI steering §3.3). */
export function ResultPanel({
  outputs,
  inputBytes,
  zipName = "mydocxtor-output.zip",
  onStartOver,
}: ResultPanelProps) {
  const single = outputs.length === 1;
  const [name, setName] = React.useState(outputs[0]?.filename ?? "output.pdf");

  const outputBytes = outputs.reduce((sum, o) => sum + o.bytes.length, 0);
  const delta = inputBytes > 0 ? Math.round((1 - outputBytes / inputBytes) * 100) : 0;
  const smaller = delta > 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-success/40 bg-success/5 p-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-5 text-success" />
        <h2 className="font-semibold">Done</h2>
      </div>

      <p className="font-mono text-sm text-muted-foreground">
        {formatBytes(inputBytes)} → {formatBytes(outputBytes)}
        {inputBytes > 0 && delta !== 0 && (
          <span className={smaller ? "text-success" : "text-warning"}>
            {" "}
            ({Math.abs(delta)}% {smaller ? "smaller" : "larger"})
          </span>
        )}
        {outputs.length > 1 && ` · ${outputs.length} files`}
      </p>

      {single ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Output name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      ) : (
        <ul className="max-h-40 overflow-auto rounded-md border border-border bg-background/60 text-sm">
          {outputs.map((o, i) => (
            <li
              key={i}
              className="flex items-center justify-between border-b border-border/60 px-3 py-1.5 last:border-0"
            >
              <span className="truncate font-mono text-xs">{o.filename}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatBytes(o.bytes.length)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {single ? (
          <Button
            onClick={() => outputs[0] && downloadBlob(outputs[0].blob, name)}
          >
            <Download /> Download
          </Button>
        ) : (
          <>
            <Button
              onClick={() =>
                downloadBlob(
                  zipFiles(outputs.map((o) => ({ name: o.filename, bytes: o.bytes }))),
                  zipName,
                )
              }
            >
              <Package /> Download as ZIP
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={onStartOver}>
          <RotateCcw /> Start over
        </Button>
      </div>
    </div>
  );
}
