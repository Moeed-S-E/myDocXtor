export interface TesseractWorkerOptions {
  workerPath?: string;
  corePath?: string;
  langPath?: string;
  workerBlobURL?: boolean;
  cacheMethod?: string;
  logger?: (m: unknown) => void;
}
export interface RecognizeOutputConfig {
  blocks?: boolean;
  text?: boolean;
}
export interface TesseractWorker {
  recognize(
    image: string | Blob | HTMLCanvasElement | ImageData,
    options?: Record<string, unknown>,
    output?: RecognizeOutputConfig,
  ): Promise<{ data: unknown }>;
  terminate(): Promise<unknown>;
}
export function createWorker(
  langs?: string | string[],
  oem?: number,
  options?: TesseractWorkerOptions,
): Promise<TesseractWorker>;

/** The prebuilt ESM bundle exposes its API on the default export. */
interface TesseractModule {
  createWorker: typeof createWorker;
}
declare const _default: TesseractModule;
export default _default;
