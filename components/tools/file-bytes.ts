import { detectType } from "@/lib/files";

export async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Classify an image file as jpeg/png for pdf-lib embedding. */
export async function imageKind(file: File): Promise<"jpeg" | "png" | null> {
  const t = await detectType(file);
  if (t === "jpeg") return "jpeg";
  if (t === "png") return "png";
  return null;
}
