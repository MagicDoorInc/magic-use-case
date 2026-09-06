import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'solid-js';
import type * as SolidWeb from 'solid-js/web';

const aRequest = () => ({ request: new Request('https://example.test/'), locals: {} });

/**
 * The entry decides, on import, how a scope is resolved for the rest of the
 * process. Nothing else in the library makes that choice, so these tests load
 * it against each build and watch what the choice does.
 */
const loadEntryInto = async (build: { isServer: boolean; getRequestEvent?: () => unknown }) => {
  vi.doMock('solid-js/web', async (importOriginal) => ({
    ...(await importOriginal<typeof SolidWeb>()),
    isServer: build.isServer,
    getRequestEvent: build.getRequestEvent ?? (() => undefined),
  }));

  await import('./index');
  return import('@magicdoor/magic-use-case-core');
};

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('solid-js/web');
});

describe('the package entry', () => {
  it('resolves a scope per request in a server build, so one request cannot read another', async () => {
    let event = aRequest();
    const { UseCase, createUseCase } = await loadEntryInto({ isServer: true, getRequestEvent: () => event });

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

  it('leaves a browser build on its one shared scope, where there is no request to resolve', async () => {
    const { UseCase, createUseCase } = await loadEntryInto({ isServer: false });

    class Counter {
      value = 0;
    }

    class Count extends UseCase<Counter> {
      protected async initializeState() {
        return new Counter();
      }
      protected async runLogic() {
        this.getState().value += 1;
      }
    }

    await expect(createUseCase(Count).execute()).resolves.toBeUndefined();
  });

  it('exposes a presenter hook the application reads its own state through', async () => {
    const { UseCase, createUseCase } = await loadEntryInto({ isServer: false });
    const entry = await import('./index');

    class Counter {
      value = 0;
    }

    class Count extends UseCase<Counter> {
      protected async initializeState() {
        return new Counter();
      }
      protected async runLogic() {
        this.getState().value += 1;
      }
    }

    await createUseCase(Count).execute();

    let shown: number | undefined;
    const dispose = createRoot((disposeRoot) => {
      const { model } = entry.usePresenter((state: Counter) => ({ shown: state.value }));
      shown = model()?.shown;
      return disposeRoot;
    });
    dispose();

    expect(shown).toBe(1);
  });
});
