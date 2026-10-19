"use client";

import * as React from "react";
import { GripVertical, Lock, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/files";
import { Button } from "@/components/ui/button";

export interface FileCardProps {
  name: string;
  size: number;
  /** Page count if known (PDFs). */
  pageCount?: number;
  /** Thumbnail object URL if rendered. */
  thumbnailUrl?: string;
  /** Password-locked indicator. */
  locked?: boolean;
  onRemove?: () => void;
  /** Props from a dnd-kit drag handle, spread onto the handle button. */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  className?: string;
}

/** A single file row/card (UI steering §3.4). */
export function FileCard({
  name,
  size,
  pageCount,
  thumbnailUrl,
  locked,
  onRemove,
  dragHandleProps,
  className,
}: FileCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-card p-3",
        className,
      )}
    >
      {dragHandleProps && (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab text-muted-foreground hover:text-foreground"
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <FileText className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {formatBytes(size)}
          {typeof pageCount === "number" && ` · ${pageCount} page${pageCount === 1 ? "" : "s"}`}
        </p>
      </div>
      {locked && (
        <span className="flex items-center gap-1 text-xs text-warning" title="Password protected">
          <Lock className="size-3.5" />
        </span>
      )}
      {onRemove && (
        <Button variant="ghost" size="icon" aria-label={`Remove ${name}`} onClick={onRemove}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
