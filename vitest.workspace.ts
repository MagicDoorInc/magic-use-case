import { defineWorkspace } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import solid from 'vite-plugin-solid';

// The adapters import the core's published entry, which resolves to its build
// output. Tests run against source so a stale `dist/` cannot make them pass —
// or fail — for the wrong reason.
const coreSource = {
  '@magicdoor/magic-use-case-core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
};

export default defineWorkspace([
  {
    test: { name: 'core', include: ['packages/core/src/**/*.test.ts'], pool: 'threads', isolate: false },
  },
  {
    resolve: { alias: coreSource },
    esbuild: { jsx: 'automatic' },
    test: {
      name: 'react',
      // A DOM is set up per file that asks for it, rather than for the whole project.
      environment: 'node',
      include: ['packages/react/src/**/*.test.{ts,tsx}'],
      pool: 'threads',
      isolate: false,
    },
  },
  {
    // Solid's JSX is compiled by its own plugin, not by esbuild: the runtime it
    // emits is what makes fine-grained updates work at all.
    plugins: [solid()],
    resolve: { alias: coreSource, conditions: ['development', 'browser'] },
    // Vitest transforms through Vite's SSR pipeline, which would otherwise pick
    // solid's server build and refuse every client-only API.
    ssr: { resolve: { conditions: ['development', 'browser'] } },
    test: {
      name: 'solid',
      // jsdom for the whole project, not per file: `environment` is what picks
      // Solid's client transform over its SSR one, and the server build compiles
      // components differently enough that the tests would stop covering them.
      environment: 'jsdom',
      include: ['packages/solid/src/**/*.test.{ts,tsx}'],
      pool: 'threads',
      isolate: false,
      server: { deps: { inline: [/solid-js/, /@solidjs\/testing-library/] } },
    },
  },
]);
