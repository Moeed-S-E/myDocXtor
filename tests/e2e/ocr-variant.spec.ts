import { test, expect, type Request } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(process.cwd(), "tests", "fixtures");

/**
 * OCR variant (F-FROM-6): PDF→Word with "Run OCR first" composes the OCR and
 * Word engines. Slower, so a generous timeout; still fully on-device.
 */
test("PDF to Word with OCR-first produces a .docx, zero outbound data", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const origin = new URL(baseURL!).origin;
  const v: string[] = [];
  page.on("request", (req: Request) => {
    const url = new URL(req.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== origin) v.push(`cross-origin ${req.url()}`);
    if (req.method() !== "GET" && req.method() !== "HEAD") v.push(`non-GET ${req.url()}`);
    if (req.postData() !== null) v.push(`body ${req.url()}`);
  });

  await page.goto("/tools/pdf-to-word/", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', join(fixtures, "doc-a.pdf"));
  await page.getByText(/Run OCR first/).click();
  await page.getByRole("button", { name: /^Convert to Word$/ }).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({ timeout: 90_000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await dl).suggestedFilename()).toContain(".docx");
  expect(v, v.join("\n")).toEqual([]);
});
