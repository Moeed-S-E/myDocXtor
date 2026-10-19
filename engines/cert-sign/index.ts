import forge from "node-forge";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AppError } from "@/lib/errors";
import type { Progress } from "@/workers/types";

/**
 * Certificate signing (design §3, F-SEC-5 — P2, OPTIONAL).
 *
 * HONEST SCOPE: this performs a *visual* certificate attestation entirely
 * on-device. It parses a PKCS#12 (.p12/.pfx) with node-forge to read the
 * signer's identity (certificate subject CN) and validity, then stamps a
 * visible "Digitally signed by …" block onto the PDF via pdf-lib.
 *
 * It does NOT embed a cryptographic PKCS#7 signature dictionary into the PDF
 * (that requires incremental-update byte-range signing, which pdf-lib doesn't
 * support). The UI states this clearly so no one mistakes it for a verifiable
 * digital signature. The private key never leaves the device.
 */

type Bytes = ArrayBuffer | Uint8Array;
type OnProgress = (p: Progress) => void;
const noop: OnProgress = () => {};

export interface CertInfo {
  commonName: string;
  organization: string;
  notBefore: string;
  notAfter: string;
}

/** Parse a PKCS#12 and extract the signer certificate's identity. */
export function readCertificate(p12Bytes: Uint8Array, password: string): CertInfo {
  let p12Asn1: forge.asn1.Asn1;
  try {
    const der = forge.util.createBuffer(
      String.fromCharCode(...Array.from(p12Bytes)),
    );
    p12Asn1 = forge.asn1.fromDer(der);
  } catch (err) {
    throw new AppError("CorruptFile", "This doesn't look like a valid .p12/.pfx file.", { cause: err });
  }
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  } catch {
    throw new AppError("WrongPassword", "The certificate password didn't work.");
  }
  // Find the first certificate bag.
  const certBagOid = forge.pki.oids.certBag ?? "1.2.840.113549.1.12.10.1.3";
  const bags = p12.getBags({ bagType: certBagOid });
  const certBags = bags[certBagOid] ?? [];
  const cert = certBags[0]?.cert;
  if (!cert) {
    throw new AppError("UnsupportedFeature", "No certificate found in this file.");
  }
  const cn = cert.subject.getField("CN")?.value ?? "Unknown";
  const org = cert.subject.getField("O")?.value ?? "";
  return {
    commonName: String(cn),
    organization: String(org),
    notBefore: cert.validity.notBefore.toISOString().slice(0, 10),
    notAfter: cert.validity.notAfter.toISOString().slice(0, 10),
  };
}

export interface CertSignPlacement {
  page: number; // 1-based
  x: number; // points, top-left origin
  y: number;
  width: number;
}

/** Stamp a visual signature block attributed to the certificate's subject. */
export async function certVisualSign(
  pdfBytes: Bytes,
  info: CertInfo,
  placement: CertSignPlacement,
  onProgress: OnProgress = noop,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) throw new AppError("Cancelled");
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes));
  } catch (err) {
    throw new AppError("CorruptFile", undefined, { cause: err });
  }
  const pages = doc.getPages();
  const page = pages[placement.page - 1];
  if (!page) throw new AppError("UnsupportedFeature", `Page ${placement.page} is out of range.`);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  const boxW = placement.width;
  const boxH = 64;
  const x = placement.x;
  const yTop = height - placement.y; // convert top-left origin
  const yBottom = yTop - boxH;

  page.drawRectangle({
    x,
    y: yBottom,
    width: boxW,
    height: boxH,
    borderColor: rgb(0.31, 0.27, 0.9),
    borderWidth: 1,
    color: rgb(0.95, 0.95, 1),
    opacity: 0.6,
  });
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    { t: `Digitally signed by ${info.commonName}`, f: bold, s: 10 },
    { t: info.organization ? info.organization : "", f: font, s: 8 },
    { t: `Date: ${date}  ·  Cert valid ${info.notBefore} → ${info.notAfter}`, f: font, s: 7 },
  ].filter((l) => l.t);

  let ty = yTop - 16;
  for (const line of lines) {
    page.drawText(line.t, { x: x + 8, y: ty, size: line.s, font: line.f, color: rgb(0.15, 0.15, 0.3) });
    ty -= line.s + 4;
  }

  onProgress({ value: 1, label: "Signed" });
  return doc.save();
}
