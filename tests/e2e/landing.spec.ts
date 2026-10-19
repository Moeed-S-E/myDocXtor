import { test, expect, type Request } from "@playwright/test";

test("landing page renders and links into the app, zero outbound data", async ({
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

  await page.goto("/", { waitUntil: "networkidle" });

  // Landing hero (not the tool grid).
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Nothing leaves your device/i);
  await expect(page.getByRole("link", { name: /Open the app/i }).first()).toBeVisible();

  // CTA navigates to /app, which shows the dropzone + tool grid.
  await page.getByRole("link", { name: /Open the app/i }).first().click();
  await expect(page).toHaveURL(/\/app\/?$/);
  await expect(page.getByText(/Choose files or drop them here/i)).toBeVisible();

  expect(violations, violations.join("\n")).toEqual([]);
});
