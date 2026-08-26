import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentMatchGlobs: [
      ["**/api*.test.ts", "node"],
      ["**/rasterize.test.ts", "node"],
    ],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["src/__tests__/setup.ts"],
    testTimeout: 60000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
