<div align="center">

# myDocXtor

**Every PDF tool. Nothing leaves your device.**

A free, open-source, privacy-first PDF toolkit (plus image tools) that runs
entirely in your browser. No uploads, no accounts, no tracking.

</div>

---

## What it is

myDocXtor is a complete PDF toolkit you can use without trusting anyone with
your files. Merge, split, compress, convert, sign, redact, OCR, fill forms and
more — all processed **on your own device**. There is no server to upload to,
because the app has no server-side file processing at all.

If you've ever hesitated to drop a contract, an ID, a medical record, or a tax
document into an online PDF tool, myDocXtor is built for you.

## Why it's different

- **Your files never leave your device.** This isn't a promise — it's enforced.
  A strict Content Security Policy (`connect-src 'self'`) makes cross-origin
  uploads structurally impossible, and an automated test proves zero bytes of
  file data ever go out.
- **Runs in your browser.** All work happens in Web Workers and WebAssembly on
  your machine, with live progress and a cancel button.
- **Works offline.** Install it as a PWA and the core tools keep working with no
  connection.
- **No accounts, no ads, no tracking.** Nothing to sign up for.
- **Free and open source (MIT).** Audit it, fork it, self-host it.

## Features

- **Organize** — merge, split, remove / extract / reorder pages, rotate, crop.
- **Optimize** — compress, add page numbers, add watermarks.
- **Convert** — PDF → JPG, Word, Excel, PowerPoint, Markdown; images → PDF;
  HTML → PDF.
- **Recognize** — OCR scanned PDFs into searchable text (self-hosted engine).
- **Edit** — add text, shapes and freehand; fill & flatten AcroForm fields;
  compare two PDFs (text + visual diff).
- **Secure** — sign (draw / type / upload), redact (true content removal),
  protect with AES passwords, unlock PDFs you have the password for, visual
  certificate signing, copy with metadata cleaning.
- **Scan** — capture pages from your camera and compile to a PDF.

Every tool shows a live "0 bytes uploaded" indicator you can verify yourself.

## Usage

Open the app, drop a PDF or image, pick a tool, and download the result — that's
it. No sign-up, no limits. Press <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>K</kbd> to
search tools.

## Privacy, by design

- Static-only hosting — no API routes, server actions, or data-touching middleware.
- Strict CSP blocks all cross-origin connections.
- All WASM, OCR data, and fonts are self-hosted; no third-party scripts or CDNs.
- A service worker caches the app for offline use but **never** caches your files.
- A Playwright test asserts zero cross-origin and zero body-bearing requests
  across every tool.

See the in-app **Privacy** page for a live network monitor, and **Licenses** for
the full dependency list (100% MIT / Apache-2.0 / BSD / ISC / MPL-2.0).

## Run it locally

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev        # http://localhost:3000
```

Build the static site:

```bash
bun run build      # outputs ./out — serve it on any static host
```

## Deploy

myDocXtor is a static export (`output: 'export'`), so it deploys anywhere that
serves static files.

- **Vercel:** import the repo; the included `vercel.json` sets the build command,
  output directory (`out`), and the privacy/security response headers. Done.
- **Any static host / CDN:** serve `./out`. Apply the headers from
  [`public/_headers`](./public/_headers) (Netlify/Cloudflare Pages read it
  automatically). For a sub-path deploy, set `NEXT_PUBLIC_BASE_PATH=/sub/path`.

## Tech

Next.js (App Router, static export) · TypeScript · Tailwind CSS · Framer Motion
· pdf-lib · pdf.js · Tesseract.js · Comlink Web Workers · Vitest · Playwright.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). The golden
rule: no user file may ever leave the device, and dependencies must stay
permissively licensed.

## License

[MIT](./LICENSE) © myDocXtor contributors. Free to use, modify, and share.
