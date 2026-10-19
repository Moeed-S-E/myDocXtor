// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { domToBlocks } from "@/engines/convert/html-to-pdf";
import { listFields, fillForm } from "@/engines/forms";

describe("domToBlocks (HTML→PDF)", () => {
  function blocks(html: string) {
    const el = document.createElement("div");
    el.innerHTML = html;
    return domToBlocks(el);
  }

  it("classifies headings with larger sizes and bold", () => {
    const b = blocks("<h1>Title</h1><p>Body</p>");
    expect(b[0]).toMatchObject({ text: "Title", bold: true });
    expect(b[0]!.size).toBeGreaterThan(b[1]!.size);
    expect(b[1]).toMatchObject({ text: "Body", bold: false });
  });

  it("marks list items as bullets", () => {
    const b = blocks("<ul><li>One</li><li>Two</li></ul>");
    expect(b).toHaveLength(2);
    expect(b.every((x) => x.bullet)).toBe(true);
  });

  it("falls back to raw text when unstructured", () => {
    const b = blocks("just text");
    expect(b[0]!.text).toContain("just text");
  });
});

describe("forms engine", () => {
  async function pdfWithTextField(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 300]);
    const form = doc.getForm();
    const field = form.createTextField("fullName");
    field.addToPage(page, { x: 50, y: 200, width: 200, height: 20 });
    return doc.save();
  }

  it("lists an AcroForm text field", async () => {
    const fields = await listFields(await pdfWithTextField());
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ name: "fullName", kind: "text" });
  });

  it("fills a field value", async () => {
    const out = await fillForm(await pdfWithTextField(), { fullName: "Ada Lovelace" }, false);
    const fields = await listFields(out);
    expect(fields[0]!.value).toBe("Ada Lovelace");
  });

  it("flatten removes fillable fields", async () => {
    const out = await fillForm(await pdfWithTextField(), { fullName: "Grace" }, true);
    const fields = await listFields(out);
    expect(fields).toHaveLength(0);
  });
});
