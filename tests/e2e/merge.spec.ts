import { test, expect, type Request } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(process.cwd(), "tests", "fixtures");

/**
 * End-to-end proof that an engine runs fully in-browser (via the Web Worker)
 * and produces a downloadable result, while STILL making zero cross-origin or
 * body-bearing requests. This exercises the real worker pipeline.
 */
test("merge runs in-browser and downloads, with zero outbound file data", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const violations: string[] = [];
  page.on("request", (req: Request) => {
    const url = new URL(req.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== origin) violations.push(`cross-origin ${req.url()}`);
    if (req.method() !== "GET" && req.method() !== "HEAD") violations.push(`non-GET ${req.url()}`);
    if (req.postData() !== null) violations.push(`body ${req.url()}`);
  });

  await page.goto("/tools/merge/", { waitUntil: "networkidle" });

  // Upload two fixtures via the hidden file input.
  await page.setInputFiles('input[type="file"]', [
    join(fixtures, "doc-a.pdf"),
    join(fixtures, "doc-b.pdf"),
  ]);

  // Both files should appear in the list.
  await expect(page.getByText("doc-a.pdf")).toBeVisible();
  await expect(page.getByText("doc-b.pdf")).toBeVisible();

  // Run merge; the result panel appears when the worker finishes.
  await page.getByRole("button", { name: /^Merge PDFs$/ }).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();

  // Result panel shows a before/after size readout.
  await expect(page.getByText(/→/)).toBeVisible();

  // Downloading the merged file triggers a browser download (no network).
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("merged.pdf");

  expect(violations, violations.join("\n")).toEqual([]);
});
