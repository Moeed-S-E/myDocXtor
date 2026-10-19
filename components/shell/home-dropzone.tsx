"use client";

import * as React from "react";
import Link from "next/link";
import { detectType, isImageType } from "@/lib/files";
import { TOOLS, type ToolDef } from "@/lib/tools";
import { Dropzone } from "@/components/file/dropzone";

/**
 * Home hero: a big dropzone that inspects the dropped file and suggests
 * relevant tools (UI steering §3.2). Nothing is uploaded — detection reads
 * only the first magic bytes locally.
 */
export function HomeDropzone() {
  const [suggestions, setSuggestions] = React.useState<ToolDef[] | null>(null);

  const onFiles = async (files: File[]) => {
    const first = files[0];
    if (!first) return;
    const type = await detectType(first);
    const kind: "pdf" | "image" | null =
      type === "pdf" ? "pdf" : isImageType(type) ? "image" : null;
    if (!kind) {
      setSuggestions([]);
      return;
    }
    setSuggestions(TOOLS.filter((t) => t.accepts.includes(kind) && t.priority === "P0"));
  };

  return (
    <div className="flex flex-col gap-4">
      <Dropzone accept={["pdf", "image"]} onFiles={onFiles} />
      {suggestions !== null && (
        <div aria-live="polite">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t match that file to a tool. Browse the full list below.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Suggested:</span>
              {suggestions.map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.slug}
                    href={`/tools/${t.slug}/`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm hover:border-primary/40"
                  >
                    <Icon className="size-4 text-primary" />
                    {t.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
