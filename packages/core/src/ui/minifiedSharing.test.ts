import { describe, it, expect } from 'vitest';
import { build } from 'esbuild';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE_ENTRY = fileURLToPath(new URL('../index.ts', import.meta.url));

/**
 * Presenters share a presentation by the identity of the function object, which
 * is the only thing about it a minifier leaves alone: names are mangled, and two
 * unrelated presentations can end up sharing one. This bundles a real program
 * against the core, minifies it, and runs the result.
 */
const runMinified = async (source: string) => {
  const dir = await mkdtemp(join(tmpdir(), 'magic-use-case-minify-'));
  const entry = join(dir, 'entry.ts');
  const out = join(dir, 'out.mjs');

  await writeFile(entry, source.replace('__CORE__', JSON.stringify(CORE_ENTRY)));
  await build({ entryPoints: [entry], outfile: out, bundle: true, minify: true, format: 'esm', platform: 'node' });

  return (await import(pathToFileURL(out).href)) as { results: Record<string, unknown> };
};

const PROGRAM = `
import { UseCase, createUseCase, Presenter } from __CORE__;

class AppState {
  count = 0;
}
class Bump extends UseCase<AppState> {
  protected async initializeState() { return new AppState(); }
  protected async runLogic() { this.getState().count += 1; }
}

let sharedRuns = 0;
const presentCount = (state: AppState) => { sharedRuns += 1; return { n: state.count }; };
let modelA: unknown, modelB: unknown;
new Presenter(presentCount).subscribe((m) => (modelA = m));
new Presenter(presentCount).subscribe((m) => (modelB = m));

// Two separately declared functions with identical bodies. They must stay
// distinct presentations however aggressively the bundle is squeezed.
let twinOneRuns = 0, twinTwoRuns = 0;
const twinOne = (state: AppState) => { twinOneRuns += 1; return { n: state.count }; };
const twinTwo = (state: AppState) => { twinTwoRuns += 1; return { n: state.count }; };
new Presenter(twinOne).subscribe(() => {});
new Presenter(twinTwo).subscribe(() => {});

await createUseCase(Bump).execute();

export const results = {
  sharedRuns,
  sameModelObject: modelA === modelB,
  model: modelA,
  twinRuns: [twinOneRuns, twinTwoRuns],
  names: [presentCount.name, twinOne.name, twinTwo.name],
};
`;

describe('a minified bundle', () => {
  it('still runs one shared presentation once, and keeps unrelated ones apart', async () => {
    const { results } = await runMinified(PROGRAM);

    // Two presenters, one presentation: built once and handed to both.
    expect(results.sharedRuns).toBe(1);
    expect(results.sameModelObject).toBe(true);
    expect(results.model).toEqual({ n: 1 });

    // Identical bodies, but two functions: two presentations, each run once.
    expect(results.twinRuns).toEqual([1, 1]);

    // The names those decisions must not depend on: gone.
    const names = results.names as string[];
    expect(names.every((name) => name !== 'presentCount' && name !== 'twinOne' && name !== 'twinTwo')).toBe(true);
  }, 30_000);
});
