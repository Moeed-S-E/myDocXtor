import * as Comlink from "comlink";
import { AppError } from "@/lib/errors";
import type { Progress, ProgressCallback } from "./types";

/**
 * A Comlink worker pool (design §2.2, §2.5).
 *
 * - Size: `navigator.hardwareConcurrency - 1`, capped at 4.
 * - Cancellation: AbortSignal is not structured-cloneable, so we do not pass it
 *   across the boundary. Instead, on abort we terminate the worker and respawn
 *   a replacement, then reject the pending job with AppError("Cancelled").
 * - Progress: the worker calls a Comlink.proxy'd callback.
 *
 * The worker module must `Comlink.expose(api)` an object whose methods take
 * `(..., onProgress)` as the final argument.
 */
export class WorkerPool<TApi extends object> {
  private readonly factory: () => Worker;
  private readonly size: number;
  private workers: { worker: Worker; api: Comlink.Remote<TApi>; busy: boolean }[] = [];
  private queue: Array<() => void> = [];

  constructor(factory: () => Worker, size?: number) {
    this.factory = factory;
    const hc = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4;
    // hardwareConcurrency - 1, clamped to [1, 4]. Explicit `size` wins if given.
    this.size = size ?? Math.max(1, Math.min(4, (hc ?? 2) - 1));
  }

  private spawn() {
    const worker = this.factory();
    const api = Comlink.wrap<TApi>(worker);
    const entry = { worker, api, busy: false };
    this.workers.push(entry);
    return entry;
  }

  private acquire(): Promise<(typeof this.workers)[number]> {
    const free = this.workers.find((w) => !w.busy);
    if (free) {
      free.busy = true;
      return Promise.resolve(free);
    }
    if (this.workers.length < this.size) {
      const entry = this.spawn();
      entry.busy = true;
      return Promise.resolve(entry);
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        const next = this.workers.find((w) => !w.busy);
        if (next) {
          next.busy = true;
          resolve(next);
        }
      });
    });
  }

  private release(entry: (typeof this.workers)[number]) {
    entry.busy = false;
    const waiter = this.queue.shift();
    if (waiter) waiter();
  }

  private replace(entry: (typeof this.workers)[number]) {
    entry.worker.terminate();
    this.workers = this.workers.filter((w) => w !== entry);
    const waiter = this.queue.shift();
    if (waiter) {
      // Give the queued job a fresh worker slot.
      this.spawn();
      waiter();
    }
  }

  /**
   * Run `method` on a pooled worker. The remote method is expected to accept
   * a trailing `onProgress` callback (wrapped via Comlink.proxy here).
   */
  async run<K extends keyof TApi>(
    method: K,
    args: unknown[],
    opts: { onProgress?: ProgressCallback; signal?: AbortSignal } = {},
  ): Promise<unknown> {
    if (opts.signal?.aborted) throw new AppError("Cancelled");
    const entry = await this.acquire();

    return new Promise((resolve, reject) => {
      let settled = false;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        this.replace(entry);
        reject(new AppError("Cancelled"));
      };
      opts.signal?.addEventListener("abort", onAbort, { once: true });

      const progressProxy = opts.onProgress
        ? Comlink.proxy((p: Progress) => opts.onProgress?.(p))
        : undefined;

      const fn = entry.api[method] as unknown as (
        ...a: unknown[]
      ) => Promise<unknown>;

      fn(...args, progressProxy)
        .then((result) => {
          if (settled) return;
          settled = true;
          opts.signal?.removeEventListener("abort", onAbort);
          this.release(entry);
          resolve(result);
        })
        .catch((err) => {
          if (settled) return;
          settled = true;
          opts.signal?.removeEventListener("abort", onAbort);
          this.release(entry);
          reject(err);
        });
    });
  }

  /** Terminate all workers (e.g. on page unload). */
  dispose() {
    for (const w of this.workers) w.worker.terminate();
    this.workers = [];
    this.queue = [];
  }

  get poolSize(): number {
    return this.size;
  }
}
