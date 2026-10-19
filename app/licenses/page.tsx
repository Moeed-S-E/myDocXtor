import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licenses — myDocXtor",
  description: "Open-source licenses. myDocXtor is MIT and uses only permissive dependencies.",
};

const DEPENDENCIES: { name: string; license: string; use: string }[] = [
  { name: "myDocXtor (this app)", license: "MIT", use: "Free and open source. Contributions welcome." },
  { name: "Next.js, React", license: "MIT", use: "App framework and UI." },
  { name: "pdf-lib", license: "MIT", use: "PDF structure edits (merge, split, rotate, crop, forms, etc.)." },
  { name: "pdf-lib-plus-encrypt", license: "MIT", use: "AES password protection (Protect PDF)." },
  { name: "pdf.js (pdfjs-dist)", license: "Apache-2.0", use: "Rendering, thumbnails, text extraction, decrypting for Unlock." },
  { name: "Tesseract.js", license: "Apache-2.0", use: "On-device OCR (self-hosted core WASM + English language data)." },
  { name: "Comlink", license: "Apache-2.0", use: "Web Worker RPC." },
  { name: "dnd-kit", license: "MIT", use: "Drag-and-drop reordering." },
  { name: "fflate", license: "MIT", use: "ZIP output." },
  { name: "diff-match-patch", license: "Apache-2.0", use: "Text diff for Compare." },
  { name: "pixelmatch", license: "ISC", use: "Visual overlay diff for Compare." },
  { name: "docx", license: "MIT", use: "PDF→Word (.docx) generation." },
  { name: "pptxgenjs", license: "MIT", use: "PDF→PowerPoint (.pptx) generation." },
  { name: "SheetJS (xlsx)", license: "Apache-2.0", use: "PDF→Excel (.xlsx) generation." },
  { name: "DOMPurify", license: "Apache-2.0 / MPL-2.0", use: "Sanitizing HTML input for HTML→PDF." },
  { name: "node-forge", license: "BSD-3-Clause", use: "Reading PKCS#12 certificates for visual certificate signing." },
  { name: "Tailwind CSS, shadcn/ui, Radix", license: "MIT", use: "Styling and primitives." },
  { name: "lucide-react", license: "ISC", use: "Icons." },
];

export default function LicensesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Licenses</h1>
      <p className="mt-4 text-muted-foreground">
        myDocXtor is <strong className="text-foreground">free and open source under the
        MIT license</strong>, built so anyone can use and contribute to it. It
        depends only on permissively licensed software (MIT, Apache-2.0, BSD,
        ISC, MPL-2.0) so the whole project stays MIT-clean — no copyleft (GPL/
        AGPL) or non-commercial code, and nothing that costs money.
      </p>
      <p className="mt-3 text-muted-foreground">
        Features that would have required copyleft or paid engines (e.g. PDF/A
        via Ghostscript, repair via MuPDF, Office→PDF via LibreOffice) are
        intentionally left out to keep the project permissive.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Dependencies</h2>
      <div className="mt-3 overflow-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Component</th>
              <th className="px-3 py-2 font-medium">License</th>
              <th className="px-3 py-2 font-medium">Use</th>
            </tr>
          </thead>
          <tbody>
            {DEPENDENCIES.map((r) => (
              <tr key={r.name} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.license}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
