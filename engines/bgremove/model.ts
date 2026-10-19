import { AppError } from "@/lib/errors";

/**
 * Automatic background segmentation (design §3). Intended to run a quantized,
 * PERMISSIVELY-LICENSED segmentation model (e.g. U²-Net / MODNet / IS-Net,
 * which are Apache-2.0 / MIT) via onnxruntime-web (MIT), fully on-device with a
 * self-hosted .onnx + WASM (no CDN).
 *
 * This is not a licensing gate — the project is MIT and these models are
 * compatible. It is simply not wired yet; the manual erase/restore path works
 * today with no model. When implemented, `segment()` will:
 *   1. lazy-import onnxruntime-web (self-hosted WASM),
 *   2. load the self-hosted quantized model once (size shown, cached),
 *   3. run inference and return a single-channel alpha mask.
 *
 * Pick a model released under Apache-2.0 or MIT (avoid non-commercial weights
 * such as RMBG-1.4) to keep the project 100% permissive.
 */

/** Enable once a permissive onnx model is bundled under /public/models. */
export const AUTO_SEGMENTATION_ENABLED = false;

/** Disclosed download size for the one-time model cache (approx). */
export const MODEL_DOWNLOAD_LABEL = "~45 MB (one-time, cached on your device)";

export interface SegmentationResult {
  /** Single-channel 0..255 alpha mask, row-major, length = width*height. */
  mask: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Produce a foreground alpha mask for an image. Not yet implemented — the
 * manual erase/restore brushes are the supported path today.
 */
export async function segment(
  _pixels: Uint8ClampedArray,
  _width: number,
  _height: number,
): Promise<SegmentationResult> {
  if (!AUTO_SEGMENTATION_ENABLED) {
    throw new AppError(
      "UnsupportedFeature",
      "Automatic background removal isn't wired up yet. Use the erase/restore brushes to remove the background manually — it runs entirely on your device.",
    );
  }
  // --- Wiring (when a permissive onnx model is bundled) ------------------
  // const ort = await import("onnxruntime-web");
  // ort.env.wasm.wasmPaths = "/wasm/";            // self-hosted WASM
  // const session = await ort.InferenceSession.create("/models/segmentation.onnx");
  // ...preprocess -> run -> postprocess to a 0..255 mask...
  throw new AppError("UnsupportedFeature", "Segmentation model not wired yet.");
}
