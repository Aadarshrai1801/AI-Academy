import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Coverage is reported in CI (`npm run test -- --run --coverage`); these
    // floors only guard against REGRESSION — they sit just under the current
    // baseline (43.8% stmts / 33.1% branch / 33.3% funcs / 46% lines).
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 40,
        branches: 28,
        functions: 30,
        lines: 42,
      },
    },
  },
});
