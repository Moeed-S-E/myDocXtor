"use client";

import * as React from "react";

/**
 * Registers the service worker in production only, with a graceful no-op when
 * unsupported (R-OFFLINE-1). Renders nothing. The SW itself never caches user
 * file data (see public/sw.js).
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Respect a deploy base path (e.g. "/myDocXtor" on GitHub Pages project
    // sites); empty for root/custom-domain deploys.
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const onLoad = () => {
      navigator.serviceWorker
        .register(`${base}/sw.js`, { scope: `${base}/` })
        .catch(() => {
          // Non-fatal: the app works without the SW, just without offline cache.
        });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
