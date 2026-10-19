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

test("PDF to Word converts in-browser and downloads .docx, zero outbound", async ({
  page,
  baseURL,
}) => {
  const v = track(page, new URL(baseURL!).origin);
  await page.goto("/tools/pdf-to-word/", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', join(fixtures, "doc-a.pdf"));
  await expect(page.getByText("doc-a.pdf")).toBeVisible();
  await page.getByRole("button", { name: /^Convert to Word$/ }).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({ timeout: 30_000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await dl).suggestedFilename()).toContain(".docx");
  expect(v, v.join("\n")).toEqual([]);
});

test("PDF to Excel converts in-browser and downloads .xlsx, zero outbound", async ({
  page,
  baseURL,
}) => {
  const v = track(page, new URL(baseURL!).origin);
  await page.goto("/tools/pdf-to-excel/", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', join(fixtures, "doc-b.pdf"));
  await expect(page.getByText("doc-b.pdf")).toBeVisible();
  await page.getByRole("button", { name: /^Convert to Excel$/ }).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({ timeout: 30_000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await dl).suggestedFilename()).toContain(".xlsx");
  expect(v, v.join("\n")).toEqual([]);
});

test("HTML to PDF converts pasted HTML and downloads, zero outbound", async ({
  page,
  baseURL,
}) => {
  const v = track(page, new URL(baseURL!).origin);
  await page.goto("/tools/html-to-pdf/", { waitUntil: "networkidle" });
  await page.locator("textarea").fill("<h1>Hello</h1><p>From myDocXtor, on-device.</p>");
  await page.getByRole("button", { name: /^Convert to PDF$/ }).click();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({ timeout: 30_000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await dl).suggestedFilename()).toContain(".pdf");
  expect(v, v.join("\n")).toEqual([]);
});
