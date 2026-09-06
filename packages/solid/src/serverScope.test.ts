import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SolidWeb from 'solid-js/web';

const aRequest = () => ({ request: new Request('https://example.test/'), locals: {} });

/**
 * The module reads the request event on every call, so the tests hand it a
 * getter they can point at a different request between calls — which is what a
 * second request arriving looks like from inside the resolver.
 */
const loadResolverSeeing = async (getEvent: () => unknown) => {
  vi.doMock('solid-js/web', async (importOriginal) => ({
    ...(await importOriginal<typeof SolidWeb>()),
    getRequestEvent: getEvent,
  }));
  return import('./serverScope');
};

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('solid-js/web');
});

describe('the scope a server request runs in', () => {
  it('gives two requests two scopes', async () => {
    let event = aRequest();
    const { resolveServerScope } = await loadResolverSeeing(() => event);

    const first = resolveServerScope();
    event = aRequest();

    expect(resolveServerScope()).not.toBe(first);
  });

  it('gives one request the same scope however often it asks', async () => {
    const event = aRequest();
    const { resolveServerScope } = await loadResolverSeeing(() => event);

    expect(resolveServerScope()).toBe(resolveServerScope());
  });

  it('keeps one request\'s state out of the next request\'s', async () => {
    let event = aRequest();
    const { resolveServerScope } = await loadResolverSeeing(() => event);
    const { UseCase, createUseCase, setScopeResolver } = await import('@magicdoor/magic-use-case-core');

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

    await createUseCase(Count).execute();
    await createUseCase(Count).execute();
    event = aRequest();
    await createUseCase(Count).execute();

    expect(counted).toEqual([1, 2, 1]);
  });

  it('refuses to resolve outside a request rather than sharing one scope', async () => {
    const { resolveServerScope } = await loadResolverSeeing(() => undefined);

    expect(() => resolveServerScope()).toThrow(/No request scope is available/);
  });
});
