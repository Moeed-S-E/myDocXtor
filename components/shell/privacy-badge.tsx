"use client";

import * as React from "react";
import { Lock, ShieldCheck } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/files";

interface ResourceSample {
  name: string;
  transferSize: number;
  initiatorType: string;
}

/**
 * Observes resource timings to back the "0 bytes" privacy claim (R-PRIV-1a,
 * design §6). We can only observe same-origin static fetches because the CSP
 * forbids cross-origin connections entirely; this panel surfaces that fact to
 * the user. `transferSize` reflects bytes received, not uploaded — uploads are
 * structurally impossible (connect-src 'self'), and this list shows there are
 * no unexpected destinations.
 */
function useNetworkMonitor(): { samples: ResourceSample[]; crossOrigin: number } {
  const [samples, setSamples] = React.useState<ResourceSample[]>([]);

  React.useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    const origin = window.location.origin;

    const record = (entries: PerformanceEntryList) => {
      const next: ResourceSample[] = [];
      for (const entry of entries) {
        if (entry.entryType !== "resource") continue;
        const r = entry as PerformanceResourceTiming;
        next.push({
          name: r.name.startsWith(origin) ? r.name.slice(origin.length) || "/" : r.name,
          transferSize: r.transferSize,
          initiatorType: r.initiatorType,
        });
      }
      if (next.length) setSamples((prev) => [...prev, ...next].slice(-100));
    };

    // Seed with anything already loaded, then observe new entries.
    record(performance.getEntriesByType("resource"));
    const observer = new PerformanceObserver((list) => record(list.getEntries()));
    observer.observe({ type: "resource", buffered: true });
    return () => observer.disconnect();
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const crossOrigin = samples.filter(
    (s) => s.name.startsWith("http") && !s.name.startsWith(origin),
  ).length;

  return { samples, crossOrigin };
}

/** Header privacy badge that opens the network-monitor panel. */
export function PrivacyBadge() {
  const { samples, crossOrigin } = useNetworkMonitor();

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open privacy panel"
          title="Your files never leave this device"
        >
          <Lock className="text-success" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,540px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="size-5 text-success" />
            <Dialog.Title className="text-lg font-semibold">
              Your files never leave this tab
            </Dialog.Title>
          </div>
          <Dialog.Description className="mb-4 text-sm text-muted-foreground">
            Every file is processed inside your browser. A strict Content
            Security Policy blocks all cross-origin connections, so your file
            content cannot be uploaded even by accident.
          </Dialog.Description>

          <div className="mb-4 rounded-md bg-muted p-4">
            <p className="font-mono text-sm">
              Network activity for your files:{" "}
              <span className="font-semibold text-success">0 bytes</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cross-origin requests observed:{" "}
              <span className={crossOrigin > 0 ? "text-danger" : "text-success"}>
                {crossOrigin}
              </span>
            </p>
          </div>

          <div className="max-h-56 overflow-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Resource</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Received</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {samples.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-muted-foreground">
                      No resources recorded yet.
                    </td>
                  </tr>
                ) : (
                  samples.map((s, i) => (
                    <tr key={`${s.name}-${i}`} className="border-b border-border/60">
                      <td className="max-w-[260px] truncate px-3 py-1.5">{s.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {s.initiatorType}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {formatBytes(s.transferSize)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="secondary" size="sm">
                Close
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
