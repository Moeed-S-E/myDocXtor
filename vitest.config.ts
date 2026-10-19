import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // Engine/lib tests are framework-free; node has full Blob/File support.
    // Component tests can opt into jsdom via a `// @vitest-environment jsdom`
    // comment at the top of the file.
    environment: "node",
    globals: true,
    // Unit tests only; Playwright owns e2e under tests/e2e.
    include: ["tests/unit/**/*.test.ts"],
  },
});
