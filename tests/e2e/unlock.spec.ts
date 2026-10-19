import { test, expect, type Request } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(process.cwd(), "tests", "fixtures");

test("Unlock PDF removes the password and downloads, zero outbound data", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const v: string[] = [];
  page.on("request", (req: Request) => {
    const url = new URL(req.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== origin) v.push(`cross-origin ${req.url()}`);
    if (req.method() !== "GET" && req.method() !== "HEAD") v.push(`non-GET ${req.url()}`);
    if (req.postData() !== null) v.push(`body ${req.url()}`);
  });

  await page.goto("/tools/unlock/", { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', join(fixtures, "encrypted.pdf"));
  await expect(page.getByText("encrypted.pdf")).toBeVisible();

  await page.getByLabel("Current password").fill("test123");
  await page.getByRole("button", { name: /^Remove password$/ }).click();

  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({ timeout: 30_000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).click();
  expect((await dl).suggestedFilename()).toContain("unlocked");

  expect(v, v.join("\n")).toEqual([]);
});
