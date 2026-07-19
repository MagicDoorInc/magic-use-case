import { defineConfig } from 'tsup';

// Core is never published. It is built only so the adapters have a single flat
// entry (JS + a bundled .d.ts) to inline. Emitting one file — rather than tsc's
// per-file output — is what keeps the adapters' bundled types free of dangling
// relative imports like './ui/Presenter'.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2020',
  clean: true,
  dts: true,
});
