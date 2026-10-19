"use client";

import * as React from "react";
import type { Progress } from "@/workers/types";
import { toUserMessage, type UserMessage, AppError } from "@/lib/errors";
import type { RunStatus } from "./use-pdf-lib-runner";

/**
 * Runs a canvas-based engine on the main thread with progress + cancel state.
 * The engine function must accept a trailing (onProgress, signal) pair and
 * yield periodically so cancellation and UI updates land (engines here do).
 */
export function useMainThreadRunner() {
  const controllerRef = React.useRef<AbortController | null>(null);
  const [status, setStatus] = React.useState<RunStatus>("idle");
  const [progress, setProgress] = React.useState<Progress>({ value: null });
  const [error, setError] = React.useState<UserMessage | null>(null);

  const run = React.useCallback(
    async <T>(
      fn: (onProgress: (p: Progress) => void, signal: AbortSignal) => Promise<T>,
    ): Promise<T> => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setStatus("running");
      setError(null);
      setProgress({ value: null });
      try {
        const result = await fn(setProgress, controller.signal);
        setStatus("done");
        setProgress({ value: 1 });
        return result;
      } catch (err) {
        if (err instanceof AppError && err.kind === "Cancelled") setStatus("cancelled");
        else {
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

  const cancel = React.useCallback(() => controllerRef.current?.abort(), []);
  const reset = React.useCallback(() => {
    setStatus("idle");
    setProgress({ value: null });
    setError(null);
  }, []);

  return { status, progress, error, run, cancel, reset };
}
