import * as Comlink from "comlink";
import * as ops from "@/engines/pdf-lib-ops";
import type { Progress } from "./types";

/**
 * pdf-lib worker. Methods mirror the engine API but take a trailing
 * `onProgress` callback (wrapped with Comlink.proxy by the pool). Cancellation
 * is handled by the pool terminating/respawning this worker, so these methods
 * don't receive an AbortSignal across the boundary.
 *
 * Inputs/outputs are Uint8Array so the pool can transfer the underlying
 * ArrayBuffers instead of copying.
 */
const api = {
  async merge(files: Uint8Array[], onProgress: (p: Progress) => void) {
    return ops.merge(files, onProgress);
  },
  async rotate(
    data: Uint8Array,
    turnDegrees: number,
    pages: number[] | "all",
    onProgress: (p: Progress) => void,
  ) {
    return ops.rotate(data, turnDegrees, pages, onProgress);
  },
  async removePages(data: Uint8Array, remove: number[], onProgress: (p: Progress) => void) {
    return ops.removePages(data, remove, onProgress);
  },
  async extractPages(data: Uint8Array, extract: number[], onProgress: (p: Progress) => void) {
    return ops.extractPages(data, extract, onProgress);
  },
  async reorderPages(data: Uint8Array, order: number[], onProgress: (p: Progress) => void) {
    return ops.reorderPages(data, order, onProgress);
  },
  async splitPdf(data: Uint8Array, mode: ops.SplitMode, onProgress: (p: Progress) => void) {
    return ops.splitPdf(data, mode, onProgress);
  },
  async addPageNumbers(
    data: Uint8Array,
    opts: ops.PageNumberOptions,
    onProgress: (p: Progress) => void,
  ) {
    return ops.addPageNumbers(data, opts, onProgress);
  },
  async addWatermark(
    data: Uint8Array,
    opts: ops.WatermarkOptions,
    onProgress: (p: Progress) => void,
  ) {
    return ops.addWatermark(data, opts, onProgress);
  },
  async imagesToPdf(
    images: { bytes: Uint8Array; type: "jpeg" | "png" }[],
    opts: ops.ImagesToPdfOptions,
    onProgress: (p: Progress) => void,
  ) {
    return ops.imagesToPdf(images, opts, onProgress);
  },
  async getPageCount(data: Uint8Array) {
    return ops.getPageCount(data);
  },
  async signPdf(
    data: Uint8Array,
    png: Uint8Array,
    placement: ops.SignPlacement,
    onProgress: (p: Progress) => void,
  ) {
    return ops.signPdf(data, png, placement, onProgress);
  },
  async cropPdf(
    data: Uint8Array,
    margins: ops.CropMargins,
    pages: number[] | "all",
    onProgress: (p: Progress) => void,
  ) {
    return ops.cropPdf(data, margins, pages, onProgress);
  },
  async copyPdf(
    data: Uint8Array,
    opts: { stripMetadata: boolean },
    onProgress: (p: Progress) => void,
  ) {
    return ops.copyPdf(data, opts, onProgress);
  },
};

export type PdfLibWorkerApi = typeof api;

Comlink.expose(api);
