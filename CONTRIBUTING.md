# Contributing to myDocXtor

Thanks for your interest in making myDocXtor better! It's a free, open-source,
privacy-first PDF toolkit, and contributions of all kinds are welcome — bug
fixes, new tools, docs, accessibility improvements, and ideas.

## The one rule that never bends

**No file a user opens may ever leave their device.** Every feature runs
entirely in the browser (Web Workers / WebAssembly). A contribution that adds a
network request carrying user content — or that would require a server — will
not be accepted. The Playwright privacy suite enforces this automatically.

## Licensing of dependencies

myDocXtor is MIT and ships only **permissive** dependencies (MIT, Apache-2.0,
BSD, ISC, MPL-2.0). Please do **not** introduce GPL/AGPL, "non-commercial", or
paid-license code or models. If a feature's only engine is copyleft, we leave
the feature out rather than compromise the license.

## Getting started

```bash
bun install
bun run dev          # http://localhost:3000
```

Common scripts:

```bash
bun run type-check   # tsc --noEmit
bun run lint         # eslint
bun run test         # vitest unit tests
bun run test:e2e     # playwright (build first: bun run build)
bun run ci           # lint + type-check + unit + build
```

## Project layout

- `app/` — Next.js App Router pages (`/` landing, `/app` tool grid, `/tools/[slug]`).
- `components/` — UI, shell, file, and per-tool components.
- `engines/` — framework-free, unit-testable processing logic (pdf-lib, pdf.js, OCR, convert, …).
- `workers/` — Comlink Web Worker + pool.
- `lib/` — tools registry, CSP, errors, helpers.
- `tests/` — Vitest unit tests and Playwright e2e (incl. the privacy sweep).

## Adding a new tool

1. Write the processing logic as a pure function in `engines/…` (no React) and
   add unit tests.
2. If it's CPU-heavy, expose it through the Web Worker (`workers/`) or the
   main-thread runner for canvas work.
3. Build the UI in `components/tools/impl/` using the shared `ToolWorkspace`.
4. Register it in `lib/tools.ts` and `components/tools/tool-shell.tsx`.
5. Add it to the Playwright privacy sweep in `tests/e2e/privacy.spec.ts` and,
   ideally, a functional e2e.

## Before you open a PR

Please make sure the full gate is green:

```bash
bun run ci && bun run build && bun run test:e2e
```

- Keep changes accessible (semantic HTML, labels, visible focus, ≥4.5:1 contrast).
- Match the existing style (Tailwind tokens in `app/globals.css`, Prettier,
  strict TypeScript). Run `bun run format`.
- Write clear commit messages and describe what you tested.

## Reporting bugs & ideas

Open an issue with steps to reproduce (and a sample file if relevant — but never
upload anything sensitive). Feature ideas and "this tool is awkward" feedback are
very welcome.

By contributing, you agree that your contributions are licensed under the
project's [MIT License](./LICENSE).
