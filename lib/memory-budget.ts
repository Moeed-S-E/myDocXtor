/**
 * Memory budget helper (design.md §2.5). Estimates the working-set cost of an
 * operation and advises whether to proceed, warn, or switch to page-by-page
 * streaming. These are heuristics, not hard guarantees — browsers don't expose
 * a reliable memory cap.
 */

/** Rough multipliers over input size for common operation classes. */
export const COST_MULTIPLIER = {
  /** Structural PDF edits (pdf-lib): parse + rebuild. */
  pdfEdit: 4,
  /** Rendering a page to a bitmap scales with DPI, not input size. */
  render: 1,
} as const;

/** Bytes for an RGBA bitmap of a page at a given DPI (US Letter 8.5x11in). */
export function renderCostBytes(dpi: number, widthIn = 8.5, heightIn = 11): number {
  const px = Math.round(widthIn * dpi) * Math.round(heightIn * dpi);
  return px * 4; // RGBA
}

export interface BudgetAdvice {
  estimateBytes: number;
  /** "ok" | "warn" (proceed but caution) | "stream" (use page-by-page). */
  level: "ok" | "warn" | "stream";
  message?: string;
}

/**
 * Advise on an operation. `deviceBudgetBytes` defaults to a conservative
 * estimate from `deviceMemory` (GiB) when available, else 2 GiB. We budget a
 * fraction of total memory for a single operation's working set.
 */
export function adviseBudget(
  inputBytes: number,
  multiplier: number = COST_MULTIPLIER.pdfEdit,
  deviceBudgetBytes: number = defaultDeviceBudget(),
): BudgetAdvice {
  const estimateBytes = inputBytes * multiplier;
  const warnAt = deviceBudgetBytes * 0.5;
  const streamAt = deviceBudgetBytes * 0.8;

  if (estimateBytes >= streamAt) {
    return {
      estimateBytes,
      level: "stream",
      message:
        "This file is large for your device. We'll process it page by page to stay stable.",
    };
  }
  if (estimateBytes >= warnAt) {
    return {
      estimateBytes,
      level: "warn",
      message: "This is a sizeable file. It may take a little longer.",
    };
  }
  return { estimateBytes, level: "ok" };
}

function defaultDeviceBudget(): number {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  // navigator.deviceMemory is in GiB (approx, Chrome only), capped at 8.
  const gib = (nav as unknown as { deviceMemory?: number })?.deviceMemory ?? 2;
  // Budget ~40% of reported memory for a single operation's working set.
  return gib * 1024 * 1024 * 1024 * 0.4;
}
