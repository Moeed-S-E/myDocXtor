import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import forge from "node-forge";
import { copyPdf, readMetadata, getPageCount } from "@/engines/pdf-lib-ops";
import { readCertificate } from "@/engines/cert-sign";
import { AppError } from "@/lib/errors";

async function makePdfWithMeta(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 300]);
  doc.setTitle("Secret Title");
  doc.setAuthor("Jane Doe");
  doc.setKeywords(["confidential"]);
  return doc.save();
}

describe("copyPdf / readMetadata", () => {
  it("duplicates without changing page count", async () => {
    const out = await copyPdf(await makePdfWithMeta(), { stripMetadata: false });
    expect(await getPageCount(out)).toBe(1);
  });

  it("preserves metadata when not stripping", async () => {
    const out = await copyPdf(await makePdfWithMeta(), { stripMetadata: false });
    const meta = await readMetadata(out);
    expect(meta.title).toBe("Secret Title");
    expect(meta.author).toBe("Jane Doe");
  });

  it("clears identifying metadata when stripping", async () => {
    const out = await copyPdf(await makePdfWithMeta(), { stripMetadata: true });
    const meta = await readMetadata(out);
    expect(meta.title).toBe("");
    expect(meta.author).toBe("");
    expect(meta.keywords).toBe("");
  });
});

/** Build a self-signed PKCS#12 for testing readCertificate. */
function makeP12(password: string): Uint8Array {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const attrs = [
    { name: "commonName", value: "Ada Lovelace" },
    { name: "organizationName", value: "Analytical Engine Co" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password);
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  const out = new Uint8Array(der.length);
  for (let i = 0; i < der.length; i++) out[i] = der.charCodeAt(i);
  return out;
}

describe("readCertificate", () => {
  it("extracts the subject identity from a PKCS#12", () => {
    const info = readCertificate(makeP12("pw"), "pw");
    expect(info.commonName).toBe("Ada Lovelace");
    expect(info.organization).toBe("Analytical Engine Co");
    expect(info.notBefore).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("throws WrongPassword on a bad password", () => {
    const p12 = makeP12("correct");
    try {
      readCertificate(p12, "wrong");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).kind).toBe("WrongPassword");
    }
  });
});
