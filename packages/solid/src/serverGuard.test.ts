import { describe, it, expect, beforeEach, vi } from 'vitest';
import type * as SolidWeb from 'solid-js/web';

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('solid-js/web');
});

/**
 * The package entry arms the guard on import, which is what keeps one request's
 * state from reaching another. Nothing else in the library decides this.
 */
describe('the package entry', () => {
  it('arms the server guard when it loads in a server build', async () => {
    vi.doMock('solid-js/web', async (importOriginal) => ({
      ...(await importOriginal<typeof SolidWeb>()),
      isServer: true,
    }));

    await import('./index');
    const { UseCase } = await import('@magicdoor/magic-use-case-core');

    class Load extends UseCase<{ v: number }> {
      protected async initializeState() {
        return { v: 1 };
      }
      protected async runLogic() {}
    }

    await expect(new Load().execute()).rejects.toThrow(/server-side rendering/);
  });

  it('leaves it off in a browser build, where one process serves one user', async () => {
    vi.doMock('solid-js/web', async (importOriginal) => ({
      ...(await importOriginal<typeof SolidWeb>()),
      isServer: false,
    }));

    await import('./index');
    const { UseCase } = await import('@magicdoor/magic-use-case-core');

    class Load extends UseCase<{ v: number }> {
      protected async initializeState() {
        return { v: 1 };
      }
      protected async runLogic() {}
    }

    await expect(new Load().execute()).resolves.toBeUndefined();
  });
});
