import { defineConfig } from 'tsup';

// Core is never published. It is built only so the adapters have a single flat
// entry (JS + one bundled .d.ts) to inline. Emitting one file — rather than
// tsc's per-file output, or pointing the package at raw src — is what keeps the
// adapters' bundled types free of dangling relative imports such as
// './ui/Presenter', which would not exist inside an adapter's dist/.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2020',
  clean: true,
  dts: true,
});
