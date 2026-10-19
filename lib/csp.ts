/**
 * Single source of truth for the Content Security Policy.
 *
 * See design.md §6 (Privacy enforcement).
 *
 * THE LOAD-BEARING DIRECTIVES for the privacy promise are:
 *   - connect-src 'self'  — no file can be POSTed/fetched to another origin.
 *   - form-action 'none'  — no form can submit anywhere.
 *   - img-src 'self' data: blob:  — no pixel-beacon exfiltration.
 *   - base-uri 'none', object-src 'none' — close injection side-channels.
 * These remain maximally strict in PRODUCTION and are what the Playwright
 * privacy test verifies (the test runs against the real static export).
 *
 * script-src includes 'unsafe-inline' because Next.js static export injects
 * inline bootstrap/hydration scripts; without it the app cannot hydrate and no
 * tool runs. Allowing inline *scripts* does NOT enable data exfiltration —
 * exfiltration needs a network channel, and every outbound channel above is
 * locked to 'self' or 'none'.
 *
 * DEVELOPMENT ONLY: `next dev` uses React Fast Refresh, which calls eval(), and
 * Hot Module Replacement over a WebSocket. So in dev we additionally allow
 * 'unsafe-eval' and ws:/wss: connect. These relaxations are compiled out of the
 * production build (`process.env.NODE_ENV`), so the shipped app never carries
 * them. The production export is what the privacy test exercises.
 */

const isDev = process.env.NODE_ENV === "development";

const SCRIPT_SRC = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
  : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'";

const CONNECT_SRC = isDev
  ? "connect-src 'self' ws: wss:" // HMR websocket in dev only
  : "connect-src 'self'";

/** Directives shared by the header and the <meta> fallback. */
const SHARED_DIRECTIVES = [
  "default-src 'self'",
  SCRIPT_SRC,
  "worker-src 'self' blob:",
  CONNECT_SRC,
  "img-src 'self' data: blob:",
  // Tailwind/Radix inject inline styles.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
];

/**
 * Full policy for the static host HTTP header (see public/_headers).
 * Includes frame-ancestors, which is only honored via a real header.
 */
export const CONTENT_SECURITY_POLICY = [
  ...SHARED_DIRECTIVES,
  "frame-ancestors 'none'",
].join("; ");

/**
 * Policy for the in-document <meta http-equiv> fallback. Omits
 * frame-ancestors (the browser ignores it in a meta element and logs a
 * console error otherwise).
 */
export const CONTENT_SECURITY_POLICY_META = SHARED_DIRECTIVES.join("; ");
