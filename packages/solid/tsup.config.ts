import { defineConfig } from 'tsup';
import * as preset from 'tsup-preset-solid';

// Solid's JSX must be compiled by babel-preset-solid (the preset's esbuild:solid
// plugin), not by esbuild's generic JSX transform — otherwise the output is React
// -shaped and not fine-grained reactive.
const parsed = preset.parsePresetOptions({
  entries: { entry: 'src/index.ts' },
  cjs: false,
});

export default defineConfig(() =>
  preset.generateTsupOptions(parsed).map((options) => ({
    ...options,
    // Inline the private core package into the bundle. `dts.resolve` is required
    // as well — without it the emitted .d.ts keeps a dangling type import to
    // @magic-use-case/core, which consumers cannot install.
    noExternal: ['@magic-use-case/core'],
    external: ['solid-js', 'solid-js/store', 'solid-js/web'],
    dts: { resolve: ['@magic-use-case/core'] },
  })),
);
