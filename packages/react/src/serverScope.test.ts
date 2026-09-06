import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The resolver is installed process-wide, so each test loads its own copy of
 * the library rather than leaving one behind for the next file.
 */
const loadScoping = async () => {
  const scoping = await import('./serverScope');
  const core = await import('@magicdoor/magic-use-case-core');
  return { ...scoping, ...core };
};

beforeEach(() => {
  vi.resetModules();
});

describe('the scope a server request runs in', () => {
  it('gives two requests two scopes', async () => {
    const { runInRequestScope, resolveServerScope } = await loadScoping();

    const first = runInRequestScope(() => resolveServerScope());
    const second = runInRequestScope(() => resolveServerScope());

    expect(second).not.toBe(first);
  });

  it('gives one request the same scope however often it asks', async () => {
    const { runInRequestScope, resolveServerScope } = await loadScoping();

    const [first, second] = runInRequestScope(() => [resolveServerScope(), resolveServerScope()]);

    expect(second).toBe(first);
  });

  it('keeps the scope across the awaits a render makes', async () => {
    const { runInRequestScope, resolveServerScope } = await loadScoping();

    const { before, after } = await runInRequestScope(async () => {
      const before = resolveServerScope();
      await Promise.resolve();
      return { before, after: resolveServerScope() };
    });

    expect(after).toBe(before);
  });

  it("keeps one request's state out of another request's", async () => {
    const { runInRequestScope, resolveServerScope, setScopeResolver, UseCase, createUseCase } = await loadScoping();

    setScopeResolver(resolveServerScope);

    const counted: number[] = [];

    class Counter {
      value = 0;
    }

    class Count extends UseCase<Counter> {
      protected async initializeState() {
        return new Counter();
      }
      protected async runLogic() {
        const state = this.getState();
        state.value += 1;
        counted.push(state.value);
      }
    }

    await runInRequestScope(async () => {
      await createUseCase(Count).execute();
      await createUseCase(Count).execute();
    });
    await runInRequestScope(async () => {
      await createUseCase(Count).execute();
    });

    expect(counted).toEqual([1, 2, 1]);
  });

  it('refuses to resolve outside a request rather than sharing one scope', async () => {
    const { resolveServerScope } = await loadScoping();

    expect(() => resolveServerScope()).toThrow(/No request scope is available/);
  });
});
