import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadCore = async () => import('../index');

beforeEach(() => {
  vi.resetModules();
});

describe('the model for the state a scope already holds', () => {
  it('has none before anything has run', async () => {
    const { currentModelFor, createScope, setScopeResolver } = await loadCore();
    setScopeResolver(() => createScope());

    expect(currentModelFor(() => ({ shown: 'anything' }))).toBeUndefined();
  });

  it('builds one from the state that is there', async () => {
    const { currentModelFor, createScope, setScopeResolver } = await loadCore();
    setScopeResolver(() => createScope({ count: 3 }));

    expect(currentModelFor((state: { count: number }) => ({ shown: state.count }))).toEqual({ shown: 3 });
  });

  it('leaves the model empty and reports a presentation that throws, rather than failing the render', async () => {
    const { currentModelFor, createScope, setScopeResolver } = await loadCore();
    setScopeResolver(() => createScope({ count: 3 }));

    const reported = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(
      currentModelFor(() => {
        throw new Error('bad mapping');
      })
    ).toBeUndefined();
    expect(reported).toHaveBeenCalledOnce();

    reported.mockRestore();
  });
});
