import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    exclude: ["**/node_modules/**", "**/tests/e2e/**", "**/.claude/worktrees/**", "**/mobile/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
});
