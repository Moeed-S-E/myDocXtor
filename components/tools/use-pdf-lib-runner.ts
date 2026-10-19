"use client";

import * as React from "react";
import { WorkerPool } from "@/workers/pool";
import type { PdfLibWorkerApi } from "@/workers/pdf-lib.worker";
import type { Progress } from "@/workers/types";
import { toUserMessage, type UserMessage, AppError } from "@/lib/errors";

/** Lazily create the shared pdf-lib worker pool (browser only). */
function createPool(): WorkerPool<PdfLibWorkerApi> {
  return new WorkerPool<PdfLibWorkerApi>(
    () =>
      new Worker(new URL("@/workers/pdf-lib.worker.ts", import.meta.url), {
        type: "module",
      }),
  );
}

export type RunStatus = "idle" | "running" | "done" | "error" | "cancelled";

interface UsePdfLibRunner {
  status: RunStatus;
  progress: Progress;
  error: UserMessage | null;
  /** Run a worker method; resolves with its result or rejects. */
  run: <K extends keyof PdfLibWorkerApi>(
    method: K,
    args: unknown[],
  ) => Promise<Awaited<ReturnType<PdfLibWorkerApi[K]>>>;
  cancel: () => void;
  reset: () => void;
}

/**
 * React hook wrapping the pdf-lib WorkerPool with progress + cancel state
 * (R-PERF-1a). The pool is created once per hook instance and disposed on
 * unmount. Cancellation aborts via the pool (terminate/respawn).
 */
export function usePdfLibRunner(): UsePdfLibRunner {
  const poolRef = React.useRef<WorkerPool<PdfLibWorkerApi> | null>(null);
  const controllerRef = React.useRef<AbortController | null>(null);
  const [status, setStatus] = React.useState<RunStatus>("idle");
  const [progress, setProgress] = React.useState<Progress>({ value: null });
  const [error, setError] = React.useState<UserMessage | null>(null);

  React.useEffect(() => {
    poolRef.current = createPool();
    return () => {
      poolRef.current?.dispose();
      poolRef.current = null;
    };
  }, []);

  const run = React.useCallback(
    async <K extends keyof PdfLibWorkerApi>(
      method: K,
      args: unknown[],
    ): Promise<Awaited<ReturnType<PdfLibWorkerApi[K]>>> => {
      if (!poolRef.current) throw new AppError("Unknown", "Worker pool not ready.");
      const controller = new AbortController();
      controllerRef.current = controller;
      setStatus("running");
      setError(null);
      setProgress({ value: null });
      try {
        const result = (await poolRef.current.run(method, args, {
          signal: controller.signal,
          onProgress: setProgress,
        })) as Awaited<ReturnType<PdfLibWorkerApi[K]>>;
        setStatus("done");
        setProgress({ value: 1 });
        return result;
      } catch (err) {
        if (err instanceof AppError && err.kind === "Cancelled") {
          setStatus("cancelled");
        } else {
          setStatus("error");
          setError(toUserMessage(err));
        }
        throw err;
      } finally {
        controllerRef.current = null;
      }
    },
    [],
  );

  const cancel = React.useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = React.useCallback(() => {
    setStatus("idle");
    setProgress({ value: null });
    setError(null);
  }, []);

  return { status, progress, error, run, cancel, reset };
}
