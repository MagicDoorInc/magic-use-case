import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2020',
  clean: true,
  treeshake: true,
  // Inline the private core package into this bundle. Consumers install only
  // this package; core is never published and has no public API surface.
  noExternal: ['@magicdoor/magic-use-case-core'],
  dts: { resolve: ['@magicdoor/magic-use-case-core'] },
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
