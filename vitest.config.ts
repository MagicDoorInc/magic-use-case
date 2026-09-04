import { defineConfig } from 'vitest/config';

/**
 * Coverage belongs to the run rather than to any one project: the three in
 * `vitest.workspace.ts` are a single suite, and core is exercised through the
 * adapters as well as directly.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      // `Presentation.ts` declares a type and nothing else: there is no code to run.
      exclude: ['**/*.test.*', '**/Presentation.ts'],
      reporter: ['text', 'json-summary'],
      // Every line of this library is reachable from its public surface, so
      // anything uncovered is either dead or untested. Both are worth failing on.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
