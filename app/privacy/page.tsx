import type { Metadata } from "next";
import { CONTENT_SECURITY_POLICY } from "@/lib/csp";

export const metadata: Metadata = {
  title: "Privacy — myDocXtor",
  description: "How myDocXtor keeps your files on your device.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-4 text-muted-foreground">
        myDocXtor processes every file inside your browser. No file, page,
        image, or extracted text is ever uploaded to a server. This is not just
        a promise — it is enforced technically.
      </p>

      <h2 className="mt-8 text-lg font-semibold">How it is enforced</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
        <li>
          The app is a static site. There are no API routes, server actions, or
          middleware that could receive your files.
        </li>
        <li>
          A strict Content Security Policy blocks all cross-origin connections
          (<code className="font-mono text-foreground">connect-src &apos;self&apos;</code>),
          so file content cannot be sent to another origin even by accident.
        </li>
        <li>No third-party analytics, fonts, or scripts are loaded.</li>
        <li>
          Heavy engines (WASM, AI models) are self-hosted and run in Web Workers
          on your device.
        </li>
        <li>Files are held in memory only and are never persisted unless you opt in.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Content Security Policy</h2>
      <pre className="mt-3 overflow-auto rounded-md border border-border bg-muted p-4 font-mono text-xs">
        {CONTENT_SECURITY_POLICY.split("; ").join(";\n")}
      </pre>

      <p className="mt-6 text-sm text-muted-foreground">
        You can verify this yourself: open the privacy panel from the header to
        see a live list of every network resource the app loads.
      </p>
    </div>
  );
}
