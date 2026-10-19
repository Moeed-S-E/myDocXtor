import type { NextConfig } from "next";

/**
 * myDocXtor static-export config.
 *
 * Privacy architecture (see design.md §1, §6):
 *  - `output: 'export'` produces a folder of static files. No API routes,
 *    no server actions, no middleware that touches user data.
 *  - The deployable is CDN-only; all compute runs in the browser.
 *
 * Note: `headers()` has no effect with `output: 'export'` — the CSP must be
 * applied by the static host AND is mirrored by a <meta> tag in the root
 * layout as a portable fallback (see app/layout.tsx and lib/csp.ts).
 *
 * Deployment: set `NEXT_PUBLIC_BASE_PATH` (e.g. "/myDocXtor") when hosting
 * under a GitHub Pages *project* path. Leave empty for a custom domain or
 * user/organization Pages served at the root. CI/CD sets it automatically.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // output: "export",
  reactStrictMode: true,
  // Required for static export: no server-side image optimization.
  images: { unoptimized: true },
  // Emit /tools/merge/index.html etc. so any static host can serve routes.
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  typescript: {
    // Never ship with type errors. CI runs `tsc --noEmit` separately too.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
