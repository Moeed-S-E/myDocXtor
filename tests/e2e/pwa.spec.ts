import { test, expect } from "@playwright/test";

/**
 * PWA assets smoke test. Confirms the installable manifest, icon, and service
 * worker are emitted to the static export and served same-origin. (The SW only
 * registers in a production browser build; here we just verify the files ship
 * and are linked, so offline support is wired.)
 */
test("manifest, icon, and service worker are served same-origin", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;

  await page.goto("/", { waitUntil: "networkidle" });

  // Manifest is linked in the document head.
  const manifestHref = await page.getAttribute('link[rel="manifest"]', "href");
  expect(manifestHref).toBeTruthy();

  // Manifest, icon, and sw.js are all fetchable and same-origin.
  for (const path of ["/manifest.webmanifest", "/icon.svg", "/sw.js"]) {
    const res = await page.request.get(`${origin}${path}`);
    expect(res.ok(), `${path} should be served`).toBeTruthy();
  }

  // Manifest parses and names the app.
  const manifest = await (await page.request.get(`${origin}/manifest.webmanifest`)).json();
  expect(manifest.short_name).toBe("myDocXtor");
  expect(Array.isArray(manifest.icons)).toBe(true);
});
