import { test, expect, type Request } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(process.cwd(), "tests", "fixtures");

/**
 * OCR runs a fully self-hosted Tesseract.js (worker + core WASM + English
 * language data served from our own origin). Proves the heavy engine works
 * under the strict CSP with zero cross-origin requests. OCR is slow, so this
 * test gets a generous timeout.
 */
test("OCR produces a searchable PDF on-device with zero outbound data", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const origin = new URL(baseURL!).origin;
  const violations: string[] = [];
  page.on("request", (req: Request) => {
    const url = new URL(req.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== origin) violations.push(`cross-origin ${req.url()}`);
    if (req.method() !== "GET" && req.method() !== "HEAD") violations.push(`non-GET ${req.url()}`);
    if (req.postData() !== null) violations.push(`body ${req.url()}`);
  });

  await page.goto("/tools/ocr/", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', join(fixtures, "doc-a.pdf"));
  await expect(page.getByText("doc-a.pdf")).toBeVisible();

  await page.getByLabel("Accuracy").selectOption("fast");
  await page.getByRole("button", { name: /^Make searchable$/ }).click();

  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({ timeout: 90_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("searchable");

  expect(violations, violations.join("\n")).toEqual([]);
});
