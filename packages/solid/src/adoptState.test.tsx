import { beforeEach, describe, expect, it, vi } from 'vitest';

const STATE_GLOBAL = '__MAGIC_USE_CASE_STATE__';

interface Leases {
  leases: string[];
}

/**
 * The entry and the reactive root have to come from the same copy of the
 * library: modules are reset per test so each gets its own resolver, and a root
 * created by an earlier copy owns nothing the new one registers.
 */
const readModelAfterLoading = async () => {
  const { usePresenter } = await import('./index');
  const { createRoot } = await import('solid-js');

  let shown: string | undefined;
  const dispose = createRoot((disposeRoot) => {
    const { model } = usePresenter((state: Leases) => ({ first: state.leases[0] }));
    shown = model()?.first;
    return disposeRoot;
  });
  dispose();

  return shown;
};

beforeEach(() => {
  vi.resetModules();
  delete (globalThis as Record<string, unknown>)[STATE_GLOBAL];
});

/**
 * The browser adopts what the server rendered from as the entry loads, before
 * anything renders — which is what keeps hydration from finding an empty tree
 * where the server had a full one.
 */
describe('a page the server rendered with data', () => {
  it('reads the transferred state without running a use case', async () => {
    (globalThis as Record<string, unknown>)[STATE_GLOBAL] = { leases: ['lease-1'] } satisfies Leases;

    expect(await readModelAfterLoading()).toBe('lease-1');
  });

  it('has no model when the server transferred nothing', async () => {
    expect(await readModelAfterLoading()).toBeUndefined();
  });
});
