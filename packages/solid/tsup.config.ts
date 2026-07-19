import { defineConfig } from 'tsup';
import * as preset from 'tsup-preset-solid';

// Solid's JSX must be compiled by babel-preset-solid (the preset's esbuild:solid
// plugin), not esbuild's generic JSX transform — otherwise the output is
// React-shaped rather than fine-grained reactive.
//
// `server_entry` produces a second bundle compiled with Solid's SSR generator.
// The exports map in package.json routes node/deno/worker to dist/server.js and
// browsers to dist/index.js.
const parsed = preset.parsePresetOptions({
  entries: [{ entry: 'src/index.ts', server_entry: true }],
  cjs: false,
});

export default defineConfig(() =>
  preset.generateTsupOptions(parsed).map((options) => ({
    ...options,
    // Inline the private core package into every bundle.
    noExternal: ['@magic-use-case/core'],
    external: ['solid-js', 'solid-js/store', 'solid-js/web'],
    // Only the client config emits types; `resolve` is required so the emitted
    // .d.ts inlines core's types instead of leaving a dangling import to a
    // package consumers cannot install.
    ...(options.dts ? { dts: { resolve: ['@magic-use-case/core'] } } : {}),
  })),
);
