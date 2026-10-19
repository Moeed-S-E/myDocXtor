import { test, expect, type Request } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(process.cwd(), "tests", "fixtures");

function track(page: import("@playwright/test").Page, origin: string) {
  const v: string[] = [];
  page.on("request", (req: Request) => {
    const url = new URL(req.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== origin) v.push(`cross-origin ${req.url()}`);
    if (req.method() !== "GET" && req.method() !== "HEAD") v.push(`non-GET ${req.url()}`);
    if (req.postData() !== null) v.push(`body ${req.url()}`);
  });
  return v;
}

test("crop runs in-browser and downloads, zero outbound data", async ({ page, baseURL }) => {
  const v = track(page, new URL(baseURL!).origin);
  await page.goto("/tools/crop/", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', join(fixtures, "doc-a.pdf"));
  await expect(page.getByText("doc-a.pdf")).toBeVisible();

  // Enter a top margin so the crop button enables.
  await page.getByLabel("Top").fill("36");
  await page.getByRole("button", { name: /^Crop PDF$/ }).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();

  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await dl).suggestedFilename()).toContain("cropped");
  expect(v, v.join("\n")).toEqual([]);
});

test("compare produces a text diff, zero outbound data", async ({ page, baseURL }) => {
  const v = track(page, new URL(baseURL!).origin);
  await page.goto("/tools/compare/", { waitUntil: "networkidle" });
  // Pick A first (its dropzone collapses to a FileCard), then B is the only
  // remaining file input.
  await page.locator('input[type="file"]').first().setInputFiles(join(fixtures, "doc-a.pdf"));
  await expect(page.getByText("doc-a.pdf")).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles(join(fixtures, "doc-b.pdf"));
  await expect(page.getByText("doc-b.pdf")).toBeVisible();

  await page.getByRole("button", { name: /^Compare$/ }).click();
  // doc-a vs doc-b differ → a change summary with +/- appears.
  await expect(page.getByText(/added,/)).toBeVisible({ timeout: 20_000 });
  expect(v, v.join("\n")).toEqual([]);
});

