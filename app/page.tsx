"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  WifiOff,
  Cpu,
  ArrowRight,
  Github,
  Lock,
  CheckCircle2,
  FileStack,
  Combine,
  Minimize2,
  ScanText,
  Image as ImageIcon,
  Quote,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  TOOLS,
} from "@/lib/tools";
import { Reveal, Stagger, StaggerItem, HoverLift, CountUp } from "@/components/shell/motion";

const TRUST_POINTS = [
  "No uploads — a strict CSP blocks every cross-origin request.",
  "Runs in Web Workers and WebAssembly on your own machine.",
  "No accounts, no analytics, no tracking of any kind.",
  "Open source under the MIT license — audit it yourself.",
];

const HIGHLIGHTS = [
  { icon: Combine, title: "Organize", body: "Merge, split, reorder, rotate, and extract pages with drag-and-drop." },
  { icon: Minimize2, title: "Optimize", body: "Compress large PDFs and strip metadata — all on your device." },
  { icon: ScanText, title: "Convert & OCR", body: "PDF ⇄ Word, Excel, images, Markdown. Make scans searchable." },
  { icon: ImageIcon, title: "Edit & secure", body: "Sign, redact, watermark, add page numbers, protect with AES." },
];

const STATS = [
  { to: 28, suffix: "", label: "Tools, all free" },
  { to: 0, suffix: " bytes", label: "Sent to any server" },
  { to: 100, suffix: "%", label: "On your device" },
  { to: 100, suffix: "% MIT", label: "Open source" },
];

const TESTIMONIALS = [
  {
    quote:
      "Finally a PDF toolkit I can use with client contracts without worrying about where the files end up. Nothing leaves my laptop.",
    name: "Priya N.",
    role: "Freelance paralegal",
  },
  {
    quote:
      "I merged and compressed a stack of medical scans on a train with no signal. It just worked, offline, instantly.",
    name: "Daniel R.",
    role: "Researcher",
  },
];

const FAQS = [
  { q: "Do my files get uploaded anywhere?", a: "No. Every tool runs in your browser. A strict Content Security Policy makes cross-origin uploads structurally impossible — it's enforced, not just promised." },
  { q: "Is it really free?", a: "Yes. myDocXtor is free and open source under the MIT license. No accounts, no paid tiers, no ads." },
  { q: "Does it work offline?", a: "After the first visit you can install it as an app and the core tools keep working with no connection." },
  { q: "Which tools are included?", a: `${TOOLS.length} tools across organizing, optimizing, converting, editing, and securing PDFs — plus image-to-PDF and more.` },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-b border-border">
      <button
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-medium">{q}</span>
        {open ? (
          <Minus className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <Plus className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && <p className="pb-4 pr-8 text-sm text-muted-foreground">{a}</p>}
    </div>
  );
}

export default function LandingPage() {
  const toolCount = TOOLS.length;

  return (
    <div className="flex flex-col">
      {/* ---- Split hero (copy left, privacy "window" right) ---- */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" />
              Processed on your device · 0 bytes uploaded
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-[46px] sm:leading-[1.05]">
              Every PDF tool.{" "}
              <span className="text-primary">Nothing leaves your device.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              A complete, free PDF toolkit plus an on-device image tool — merge,
              split, compress, convert, sign, redact, OCR and more. Processed
              entirely in your browser. No upload, ever.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/app/">
                  Open the app <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/privacy/">How your privacy is protected</Link>
              </Button>
            </div>
            <p className="mt-5 font-mono text-xs text-muted-foreground">
              {toolCount} tools · free &amp; open source (MIT) · no sign-up
            </p>
          </Reveal>

          {/* Hero visual: a stylized privacy "monitor" (replaces the wireframe's image box) */}
          <Reveal delay={0.1} y={28}>
            <div className="rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  mydocxtor — on your device
                </span>
              </div>
              <div className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
                  <Lock className="size-5 text-success" />
                  <div className="text-sm">
                    <p className="font-medium">Network activity for your files</p>
                    <p className="font-mono text-success">0 bytes</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[Combine, Minimize2, ScanText, ImageIcon, FileStack, ShieldCheck].map((Icon, i) => (
                    <div key={i} className="flex aspect-square items-center justify-center rounded-md border border-border bg-background">
                      <Icon className="size-5 text-primary" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- Trust + checklist (wireframe: "Why clients trust us") ---- */}
      <section className="mx-auto w-full max-w-5xl px-4 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            Why people trust it
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[32px]">
            The privacy promise is the product
          </h2>
          <p className="mt-3 text-muted-foreground">
            Most online PDF tools upload your files to a server. myDocXtor never
            does — and it&apos;s enforced technically, not just promised.
          </p>
        </Reveal>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          {/* image cluster → stat/feature tiles */}
          <Stagger className="grid grid-cols-2 gap-4">
            {[
              { icon: Lock, label: "On-device only" },
              { icon: Cpu, label: "WASM + Workers" },
              { icon: WifiOff, label: "Works offline" },
              { icon: Github, label: "Open source" },
            ].map(({ icon: Icon, label }) => (
              <StaggerItem key={label}>
                <div className="flex h-32 flex-col justify-between rounded-lg border border-border bg-card p-4">
                  <Icon className="size-6 text-primary" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          {/* checklist with check icons (matches wireframe) */}
          <Stagger className="flex flex-col gap-4">
            {TRUST_POINTS.map((point) => (
              <StaggerItem key={point}>
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" />
                  <p className="text-sm text-foreground">{point}</p>
                </div>
              </StaggerItem>
            ))}
            <StaggerItem>
              <Button asChild className="mt-2 w-fit">
                <Link href="/privacy/">
                  Read the privacy details <ArrowRight className="size-4" />
                </Link>
              </Button>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* ---- Stats band (wireframe: business-strategy stats row) ---- */}
      <section className="border-y border-border bg-surface/60" style={{ background: "hsl(var(--muted))" }}>
        <div className="mx-auto w-full max-w-5xl px-4 py-16">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-[32px]">
              Built to be fast, private, and genuinely free
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((s) => (
              <Reveal key={s.label} className="text-center">
                <div className="font-mono text-3xl font-semibold text-primary sm:text-4xl">
                  <CountUp to={s.to} suffix={s.suffix} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Category strip (wireframe: "Our partners" logo row) ---- */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16">
        <Reveal className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            A tool for every job
          </span>
        </Reveal>
        <Stagger className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {CATEGORY_ORDER.map((c) => (
            <StaggerItem key={c}>
              <span className="text-sm font-medium text-muted-foreground">
                {CATEGORY_LABELS[c]}
              </span>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ---- Highlight cards (wireframe: "Latest blog" card row) ---- */}
      <section className="border-y border-border" style={{ background: "hsl(var(--muted) / 0.4)" }}>
        <div className="mx-auto w-full max-w-5xl px-4 py-20">
          <Reveal className="flex items-center gap-2">
            <FileStack className="size-5 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight sm:text-[32px]">
              Everything a PDF needs
            </h2>
          </Reveal>
          <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <StaggerItem key={title}>
                <HoverLift>
                  <div className="h-full rounded-lg border border-border bg-card p-5">
                    <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-4 font-medium">{title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                  </div>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal className="mt-8 text-center">
            <Button asChild>
              <Link href="/app/">
                Browse all {toolCount} tools <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ---- Testimonials (wireframe: "Our happy clients") ---- */}
      <section className="mx-auto w-full max-w-5xl px-4 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            Loved by privacy-minded people
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[32px]">
            Quiet, trustworthy, out of your way
          </h2>
        </Reveal>
        <Stagger className="mt-10 grid gap-4 sm:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <StaggerItem key={t.name}>
              <figure className="flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-6">
                <Quote className="size-6 text-accent" />
                <blockquote className="text-sm leading-relaxed">{t.quote}</blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                    {t.name[0]}
                  </span>
                  <span className="text-sm">
                    <strong>{t.name}</strong>
                    <br />
                    <span className="text-muted-foreground">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ---- FAQ (wireframe: image + accordion) ---- */}
      <section className="border-y border-border" style={{ background: "hsl(var(--muted) / 0.4)" }}>
        <div className="mx-auto grid w-full max-w-5xl items-start gap-10 px-4 py-20 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">
              FAQ
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[32px]">
              Questions, answered
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Still curious? The privacy page shows a live network monitor that
              proves zero bytes leave your device.
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/privacy/">Open the privacy page</Link>
            </Button>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="rounded-lg border border-border bg-card px-5">
              {FAQS.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- Dark CTA bar (wireframe: "Need more information?" dark band) ---- */}
      <section className="mx-auto w-full max-w-5xl px-4 py-20">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-6 rounded-lg bg-primary p-8 sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-primary-foreground sm:text-[30px]">
                Start in the next 10 seconds
              </h2>
              <p className="mt-2 text-primary-foreground/70">
                No sign-up, no card, no catch. Drop a file and go.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              <Link href="/app/">
                Open the app <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
