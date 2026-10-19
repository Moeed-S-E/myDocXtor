"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Hourglass } from "lucide-react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { Button } from "@/components/ui/button";
import { MergeTool } from "./impl/merge-tool";
import { RotateTool } from "./impl/rotate-tool";
import { ExtractPagesTool, RemovePagesTool } from "./impl/range-tools";
import { SplitTool } from "./impl/split-tool";
import { PageNumbersTool } from "./impl/page-numbers-tool";
import { WatermarkTool } from "./impl/watermark-tool";
import { OrganizeTool } from "./impl/organize-tool";
import { ImageToPdfTool } from "./impl/image-to-pdf-tool";
import { PdfToJpgTool } from "./impl/pdf-to-jpg-tool";
import { CompressTool } from "./impl/compress-tool";
import { SignTool } from "./impl/sign-tool";
import { RedactTool } from "./impl/redact-tool";
// import { BackgroundRemoverTool } from "./impl/background-remover-tool"; // DISABLED (not working)
import { CropTool } from "./impl/crop-tool";
import { PdfToMarkdownTool } from "./impl/pdf-to-markdown-tool";
import { CompareTool } from "./impl/compare-tool";
import { OcrTool } from "./impl/ocr-tool";
import { PdfToWordTool } from "./impl/pdf-to-word-tool";
import { PdfToExcelTool } from "./impl/pdf-to-excel-tool";
import { PdfToPptTool } from "./impl/pdf-to-ppt-tool";
import { HtmlToPdfTool } from "./impl/html-to-pdf-tool";
import { FormsTool } from "./impl/forms-tool";
import { ScanTool } from "./impl/scan-tool";
import { EditTool } from "./impl/edit-tool";
import { CopyTool } from "./impl/copy-tool";
import { CertSignTool } from "./impl/cert-sign-tool";
import { ProtectTool } from "./impl/protect-tool";
import { UnlockTool } from "./impl/unlock-tool";

/** Maps a tool slug to its implemented UI. */
const IMPLEMENTED: Record<string, React.ComponentType> = {
  merge: MergeTool,
  rotate: RotateTool,
  "extract-pages": ExtractPagesTool,
  "remove-pages": RemovePagesTool,
  split: SplitTool,
  "page-numbers": PageNumbersTool,
  watermark: WatermarkTool,
  organize: OrganizeTool,
  "image-to-pdf": ImageToPdfTool,
  "pdf-to-jpg": PdfToJpgTool,
  compress: CompressTool,
  sign: SignTool,
  redact: RedactTool,
  // "background-remover": BackgroundRemoverTool, // DISABLED (not working)
  crop: CropTool,
  "pdf-to-markdown": PdfToMarkdownTool,
  compare: CompareTool,
  ocr: OcrTool,
  "pdf-to-word": PdfToWordTool,
  "pdf-to-excel": PdfToExcelTool,
  "pdf-to-ppt": PdfToPptTool,
  "html-to-pdf": HtmlToPdfTool,
  forms: FormsTool,
  scan: ScanTool,
  edit: EditTool,
  copy: CopyTool,
  "cert-sign": CertSignTool,
  protect: ProtectTool,
  unlock: UnlockTool,
};

/** Entry point for a tool route. Dispatches to the tool's implementation. */
export function ToolShell({ slug }: { slug: string }) {
  const tool = TOOLS_BY_SLUG[slug];
  if (!tool) return null;

  const Impl = IMPLEMENTED[slug];
  if (Impl) return <Impl />;

  // Fallback for any tool not yet wired (none at present).
  const Icon = tool.icon;
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
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <Hourglass className="size-8 text-muted-foreground" />
        <p className="text-base font-medium">Coming in a later phase</p>
        <p className="max-w-md text-sm text-muted-foreground">
          This tool ({tool.priority}) isn&apos;t wired up yet. The engine will run
          entirely in your browser when it ships — nothing will leave your device.
        </p>
        <Button asChild variant="secondary">
          <Link href="/app/">Browse available tools</Link>
        </Button>
      </div>
    </div>
  );
}
