import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Tailwind's PostCSS plugin is built for Next's pipeline and throws when Vite
  // loads it ("Invalid PostCSS Plugin found at: plugins[0]"), which took out any
  // test whose component imports a CSS module. Nothing here asserts on styles —
  // the class names are only needed as opaque strings — so the transform is
  // pointed at an empty plugin list rather than at postcss.config.mjs.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
      "server-only": path.resolve(dirname, "test/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.mts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/app/**/layout.tsx", "src/app/**/page.tsx"],
    },
  },
});
