import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { protectPdf, unlockPdf } from "@/engines/protect";
import { AppError } from "@/lib/errors";

async function makePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 300]);
  return doc.save();
}

/** A plain pdf-lib load fails on an encrypted doc (proves real encryption). */
async function isEncrypted(bytes: Uint8Array): Promise<boolean> {
  try {
    await PDFDocument.load(bytes);
    return false;
  } catch {
    return true;
  }
}

describe("protect", () => {
  it("protectPdf produces an encrypted document", async () => {
    const protectedBytes = await protectPdf(await makePdf(), {
      userPassword: "s3cret",
      permissions: { printing: true, copying: false, modifying: false, annotating: true },
    });
    expect(await isEncrypted(protectedBytes)).toBe(true);
  });

  it("protectPdf requires a password", async () => {
    await expect(
      protectPdf(await makePdf(), {
        userPassword: "",
        permissions: { printing: true, copying: true, modifying: true, annotating: true },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("unlock (password handling)", () => {
  // The full unlock round-trip renders pages via pdf.js (needs a browser
  // canvas), so it is proven in the e2e suite. Here we assert the no-guessing
  // contract: a wrong/missing password surfaces a typed error rather than
  // silently succeeding.
  it("rejects a wrong password (never guesses)", async () => {
    const protectedBytes = await protectPdf(await makePdf(), {
      userPassword: "right",
      permissions: { printing: true, copying: true, modifying: true, annotating: true },
    });
    await expect(unlockPdf(protectedBytes, "wrong")).rejects.toBeInstanceOf(AppError);
  });
});
