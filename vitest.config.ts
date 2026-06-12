import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/hooks/**/*.ts"],
      exclude: ["src/lib/**/*.functions.ts"],
    },
  },
});
