import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Generates small multi-page PDFs under tests/fixtures for Playwright flows. */
async function makePdf(label: string, pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`${label} — page ${i + 1}`, { x: 72, y: 700, size: 24, font });
  }
  return doc.save();
}

async function main() {
  const dir = join(dirname(fileURLToPath(import.meta.url)));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "doc-a.pdf"), await makePdf("Document A", 2));
  writeFileSync(join(dir, "doc-b.pdf"), await makePdf("Document B", 3));
  // A small opaque PNG (64x64) for the background-remover flow.
  writeFileSync(join(dir, "sample.png"), makeSamplePng(64, 64));
  // An AES-encrypted PDF (open password "test123") for the Unlock e2e.
  writeFileSync(join(dir, "encrypted.pdf"), await makeEncrypted());
  // eslint-disable-next-line no-console
  console.log("Wrote fixtures to", dir);
}

/** Build an AES-encrypted PDF using the MIT pdf-lib-plus-encrypt fork. */
async function makeEncrypted(): Promise<Uint8Array> {
  const { PDFDocument: EncDoc } = await import("pdf-lib-plus-encrypt");
  const doc = await EncDoc.create();
  doc.addPage([400, 300]);
  await doc.encrypt({ userPassword: "test123", ownerPassword: "test123", pdfVersion: "2.0" });
  return doc.save();
}

/** Minimal valid 64x64 RGBA PNG (solid color), hand-encoded via zlib. */
function makeSamplePng(w: number, h: number): Buffer {
  // Build raw image data: each row prefixed with filter byte 0.
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      raw[o++] = 80; // R
      raw[o++] = 160; // G
      raw[o++] = 220; // B
      raw[o++] = 255; // A
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zlib = require("node:zlib") as typeof import("node:zlib");
  const idatData = zlib.deflateSync(raw);

  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return crc ^ 0xffffffff;
}

void main();
