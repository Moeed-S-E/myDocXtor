import { test, expect, type Request } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(process.cwd(), "tests", "fixtures");

function trackViolations(page: import("@playwright/test").Page, origin: string) {
  const violations: string[] = [];
  page.on("request", (req: Request) => {
    const url = new URL(req.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== origin) violations.push(`cross-origin ${req.url()}`);
    if (req.method() !== "GET" && req.method() !== "HEAD") violations.push(`non-GET ${req.url()}`);
    if (req.postData() !== null) violations.push(`body ${req.url()}`);
  });
  return violations;
}

test("PDF to JPG renders in-browser and downloads a ZIP, zero outbound data", async ({
  page,
  baseURL,
}) => {
  const violations = trackViolations(page, new URL(baseURL!).origin);

  await page.goto("/tools/pdf-to-jpg/", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', join(fixtures, "doc-b.pdf"));
  await expect(page.getByText("doc-b.pdf")).toBeVisible();

  await page.getByRole("button", { name: /^Convert to JPG$/ }).click();
  // doc-b has 3 pages → multiple outputs → ZIP download.
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({ timeout: 20_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download as ZIP/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("pdf-to-jpg");

  expect(violations, violations.join("\n")).toEqual([]);
});
