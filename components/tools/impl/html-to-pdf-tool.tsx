"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ResultPanel, type ResultOutput } from "../result-panel";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { bytesToPdfBlob } from "@/lib/download";
import { htmlToPdf } from "@/engines/convert/html-to-pdf";

export function HtmlToPdfTool() {
  const tool = TOOLS_BY_SLUG["html-to-pdf"]!;
  const runner = useMainThreadRunner();
  const [html, setHtml] = React.useState("");
  const [result, setResult] = React.useState<{ outputs: ResultOutput[]; inputBytes: number } | null>(null);
  const Icon = tool.icon;

  const onUpload = async (file: File) => {
    const text = await file.text();
    setHtml(text);
  };

  const run = async () => {
    try {
      const out = await runner.run((onProgress, signal) => htmlToPdf(html, {}, onProgress, signal));
      setResult({
        outputs: [{ bytes: out, blob: bytesToPdfBlob(out), filename: "page.pdf" }],
        inputBytes: new Blob([html]).size,
      });
    } catch {
      /* surfaced via runner.error */
    }
  };

  const startOver = () => {
    setResult(null);
    setHtml("");
    runner.reset();
  };

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

      {runner.error && (
        <div role="alert" className="mb-4 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm">
          <p className="font-medium text-danger">{runner.error.title}</p>
          <p className="text-muted-foreground">{runner.error.nextStep}</p>
        </div>
      )}

      {result ? (
        <ResultPanel
          outputs={result.outputs}
          inputBytes={result.inputBytes}
          onStartOver={startOver}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={16}
              placeholder="Paste HTML here, or upload an .html file. Remote images are blocked for your privacy; use inline or data: images."
              className="w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
              <Upload className="size-4" /> Upload .html / .mhtml
              <input
                type="file"
                accept=".html,.htm,.mhtml,text/html"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
            </label>
          </div>
          <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-4">
            {runner.status === "running" ? (
              <Progress value={runner.progress.value} label={runner.progress.label} onCancel={runner.cancel} />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Your HTML is sanitized and rendered entirely on your device.
                </p>
                <Button onClick={run} disabled={!html.trim()}>
                  Convert to PDF
                </Button>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
