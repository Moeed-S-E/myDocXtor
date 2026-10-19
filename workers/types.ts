/**
 * Shared worker/engine types (design §2.4, §2.5). Engines are framework-free
 * and expose a typed API like:
 *   merge(files, opts, onProgress, signal): Promise<Blob>
 * so they can be unit tested without a browser UI.
 */

export interface Progress {
  /** 0..1, or null for indeterminate. */
  value: number | null;
  /** Optional "Page 14 of 52" style label. */
  label?: string;
}

export type ProgressCallback = (progress: Progress) => void;

/**
 * A long-running engine task. Implementations must observe `signal` and reject
 * with an AppError("Cancelled") when aborted, and should report progress.
 */
export type EngineTask<TArgs extends unknown[], TResult> = (
  ...args: [...TArgs, ProgressCallback, AbortSignal]
) => Promise<TResult>;
