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

test("Edit PDF adds an annotation and saves, zero outbound data", async ({ page, baseURL }) => {
  const v = track(page, new URL(baseURL!).origin);
  await page.goto("/tools/edit/", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', join(fixtures, "doc-a.pdf"));

  // Wait for the page canvas to render, then draw a rectangle on it.
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  // Switch to the rectangle tool (second tool button).
  await page.getByRole("button", { name: "rect" }).click();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 60, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 180, box.y + 140, { steps: 4 });
    await page.mouse.up();
  }

  const save = page.getByRole("button", { name: /^Save edits/ });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({ timeout: 30_000 });

  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await dl).suggestedFilename()).toContain("edited");
  expect(v, v.join("\n")).toEqual([]);
});

test("Scan to PDF compiles an uploaded photo, zero outbound data", async ({ page, baseURL }) => {
  const v = track(page, new URL(baseURL!).origin);
  await page.goto("/tools/scan/", { waitUntil: "networkidle" });
  // Upload a photo via the hidden file input (camera path needs a device).
  await page.setInputFiles('input[type="file"]', join(fixtures, "sample.png"));
  const compile = page.getByRole("button", { name: /^Compile to PDF/ });
  await expect(compile).toBeEnabled();
  await compile.click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({ timeout: 30_000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await dl).suggestedFilename()).toContain(".pdf");
  expect(v, v.join("\n")).toEqual([]);
});
