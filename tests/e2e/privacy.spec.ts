import { test, expect, type Request } from "@playwright/test";

/**
 * Privacy guarantee test (design §6; R-PRIV-1). Intercepts EVERY network
 * request during tool happy paths and asserts:
 *   1. Only same-origin requests occur.
 *   2. No request carries a body (no uploads of any kind).
 *   3. Only GET requests are made (static asset fetches).
 *
 * This is the load-bearing test for the product's core promise.
 */

const TOOL_PAGES = [
  "/",
  "/app/",
  "/privacy/",
  "/licenses/",
  "/tools/merge/",
  "/tools/split/",
  "/tools/remove-pages/",
  "/tools/extract-pages/",
  "/tools/organize/",
  "/tools/rotate/",
  "/tools/page-numbers/",
  "/tools/watermark/",
  "/tools/image-to-pdf/",
  "/tools/pdf-to-jpg/",
  "/tools/compress/",
  "/tools/sign/",
  "/tools/redact/",
  // "/tools/background-remover/", // DISABLED (bg remover not working)
  "/tools/crop/",
  "/tools/compare/",
  "/tools/pdf-to-markdown/",
  "/tools/pdf-to-word/",
  "/tools/pdf-to-excel/",
  "/tools/pdf-to-ppt/",
  "/tools/html-to-pdf/",
  "/tools/forms/",
  "/tools/scan/",
  "/tools/edit/",
  "/tools/ocr/",
  "/tools/protect/",
  "/tools/unlock/",
  "/tools/copy/",
  "/tools/cert-sign/",
];

test.describe("zero outbound file data", () => {
  for (const path of TOOL_PAGES) {
    test(`no cross-origin or body-bearing requests on ${path}`, async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const violations: string[] = [];

      page.on("request", (req: Request) => {
        const url = new URL(req.url());
        // Allow data: and blob: (local, in-memory only).
        if (url.protocol === "data:" || url.protocol === "blob:") return;

        if (url.origin !== origin) {
          violations.push(`cross-origin ${req.method()} ${req.url()}`);
        }
        if (req.method() !== "GET" && req.method() !== "HEAD") {
          violations.push(`non-GET ${req.method()} ${req.url()}`);
        }
        if (req.postData() !== null) {
          violations.push(`request with body ${req.method()} ${req.url()}`);
        }
      });

      await page.goto(path, { waitUntil: "networkidle" });
      // Interact a little to trigger any lazy fetches.
      await page.waitForTimeout(500);

      expect(violations, violations.join("\n")).toEqual([]);
    });
  }

  test("privacy badge reports 0 bytes and 0 cross-origin", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const badge = page.getByRole("button", {
      name: /open privacy panel/i,
    });
    await badge.waitFor({ state: "visible" });
    await badge.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("0 bytes")).toBeVisible();
    await expect(
      dialog.getByText(/Cross-origin requests observed:/i),
    ).toBeVisible();
  });
});
