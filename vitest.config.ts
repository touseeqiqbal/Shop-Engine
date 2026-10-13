import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** `npm test` – fast unit tests for the money, delivery, access and safety rules (no database needed). */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" refuses to load outside Next.js' server build – harmless to stub in tests
      "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)),
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
