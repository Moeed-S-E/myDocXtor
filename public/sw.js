/*
 * myDocXtor service worker (hand-written; design §2.2, §2.6).
 *
 * PRIVACY RULES (non-negotiable):
 *  - Only ever cache SAME-ORIGIN, GET requests for static assets.
 *  - NEVER cache cross-origin requests (there are none — CSP forbids them).
 *  - NEVER cache anything that could carry user file data. User files are held
 *    in memory and processed in workers; they never become network requests,
 *    so the fetch handler below simply ignores anything that isn't a GET for a
 *    same-origin static asset.
 *
 * Caching strategy:
 *  - App shell (navigations + core routes): network-first, fall back to cache,
 *    so updates land but the app still opens offline (R-OFFLINE-1).
 *  - Static/engine chunks (/_next/static, wasm, fonts, icons): stale-while-
 *    revalidate for instant loads + background refresh.
 */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

// Base path = the SW's registration scope path (e.g. "/" at a root/custom
// domain, or "/myDocXtor/" under a GitHub Pages project path). Everything is
// resolved relative to it so the SW works at any deploy prefix.
const BASE = new URL(self.registration.scope).pathname; // always ends with "/"
const atBase = (p) => (p.startsWith("/") ? BASE.replace(/\/$/, "") + p : BASE + p);

// Precache the minimal shell so the app opens offline after first visit.
const SHELL_URLS = [BASE, "privacy/", "licenses/", "manifest.webmanifest", "icon.svg"].map(
  (p) => (p === BASE ? BASE : atBase(p)),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  // Directory checks are relative to the deploy base path; the extension
  // regex catches hashed assets regardless of prefix.
  const p = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length - 1) : url.pathname;
  return (
    p.startsWith("/_next/static/") ||
    p.startsWith("/wasm/") ||
    p.startsWith("/models/") ||
    p.startsWith("/tessdata/") ||
    p.startsWith("/tesseract/") ||
    p.startsWith("/fonts/") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|ico|wasm|webmanifest)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GETs. Everything else goes straight to the network
  // untouched — we never cache or inspect potential data-bearing requests.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Navigations / HTML: network-first with cache fallback (offline support).
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || (await caches.match(BASE)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
  }
  // Anything else: let it hit the network normally (not cached).
});
