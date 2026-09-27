import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2020',
  clean: true,
  dts: true,
  external: ['eslint', '@typescript-eslint/utils'],
});
