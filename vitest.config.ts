import { defineConfig } from "vitest/config";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
      "tests/**/*.test.ts",
    ],
    // Use node for non-component tests
    environmentMatchGlobs: [
      ["src/**/__tests__/**/*.test.ts", "node"],
      ["tests/**/*.test.ts", "node"],
    ],
    setupFiles: ["./vitest.setup.ts"],
    css: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
