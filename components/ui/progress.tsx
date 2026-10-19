"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface ProgressState {
  /** 0..1, or null for indeterminate. */
  value: number | null;
  /** Optional "Page 14 of 52" style label. */
  label?: string;
}

interface ProgressProps extends ProgressState {
  onCancel?: () => void;
  className?: string;
}

/**
 * Inline progress bar with an optional page counter and cancel control
 * (UI steering §3.3; R-PERF-1a). Never a blocking modal.
 */
export function Progress({ value, label, onCancel, className }: ProgressProps) {
  const pct = value === null ? undefined : Math.round(value * 100);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-175 ease-out-soft",
            value === null && "w-1/3 animate-pulse",
          )}
          style={value === null ? undefined : { width: `${pct}%` }}
        />
      </div>
      {label && (
        <span
          className="font-mono text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {label}
        </span>
      )}
      {onCancel && (
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X />
          Cancel
        </Button>
      )}
    </div>
  );
}
