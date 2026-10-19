import { test, expect, type Request } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(process.cwd(), "tests", "fixtures");

// The Background remover is temporarily DISABLED in the frontend (not working),
// so this flow is skipped. Re-enable alongside the tool in lib/tools.ts and
// components/tools/tool-shell.tsx.
test.skip("background remover works manually on-device with zero outbound data", async ({
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

  await page.goto("/tools/background-remover/", { waitUntil: "networkidle" });

  // Auto removal isn't wired yet; the manual path is offered.
  await expect(page.getByText(/Automatic AI removal isn't wired up yet/i)).toBeVisible();

  await page.setInputFiles('input[type="file"]', join(fixtures, "sample.png"));

  // Canvas + brushes appear.
  const canvas = page.getByRole("img", { name: "Image preview" });
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("button", { name: /^Erase$/ })).toBeVisible();

  // Erase by dragging across the canvas.
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 5 });
    await page.mouse.up();
  }

  // Export PNG triggers a download.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download PNG/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("cutout.png");

  expect(violations, violations.join("\n")).toEqual([]);
});
