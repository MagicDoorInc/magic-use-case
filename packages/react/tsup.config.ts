import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm'],
  target: 'es2020',
  clean: true,
  // Each entry stands alone: a shared chunk would put the server's serializer
  // in the file the browser entry imports.
  splitting: false,
  treeshake: true,
  // Inline the private core package into this bundle. Consumers install only
  // this package; core is never published and has no public API surface.
  //
  // seroval is inlined too, and only the server entry reaches it: `splitting`
  // is off, so the browser entry cannot end up importing the chunk it lives in.
  noExternal: ['@magicdoor/magic-use-case-core', 'seroval'],
  dts: { entry: ['src/index.ts', 'src/server.ts'], resolve: ['@magicdoor/magic-use-case-core'] },
  external: ['react', 'react-dom', 'react/jsx-runtime', /^node:/],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
