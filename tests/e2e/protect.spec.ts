import { test, expect, type Request } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(process.cwd(), "tests", "fixtures");

test("Protect PDF encrypts and downloads, zero outbound data", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const v: string[] = [];
  page.on("request", (req: Request) => {
    const url = new URL(req.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== origin) v.push(`cross-origin ${req.url()}`);
    if (req.method() !== "GET" && req.method() !== "HEAD") v.push(`non-GET ${req.url()}`);
    if (req.postData() !== null) v.push(`body ${req.url()}`);
  });

  await page.goto("/tools/protect/", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', join(fixtures, "doc-a.pdf"));
  await expect(page.getByText("doc-a.pdf")).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill("s3cret-pw");
  await page.getByLabel("Confirm password").fill("s3cret-pw");
  await page.getByRole("button", { name: /Protect with AES-256/ }).click();

  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({ timeout: 20_000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await dl).suggestedFilename()).toContain("protected");

  expect(v, v.join("\n")).toEqual([]);
});
