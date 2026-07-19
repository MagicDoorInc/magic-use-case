import { describe, it, expect, beforeEach, vi } from 'vitest';

// The guard is module-level state, so each test needs a fresh module graph.
beforeEach(() => {
  vi.resetModules();
});

describe('server guard', () => {
  it('is off by default, so client behaviour is unchanged', async () => {
    const { assertNotOnServer, isServerGuardEnabled } = await import('./serverGuard');

    expect(isServerGuardEnabled()).toBe(false);
    expect(() => assertNotOnServer('Anything')).not.toThrow();
  });

  it('throws once enabled, naming the operation', async () => {
    const { enableServerGuard, assertNotOnServer } = await import('./serverGuard');
    enableServerGuard();

    expect(() => assertNotOnServer('Executing a use case')).toThrow(
      /Executing a use case is not available during server-side rendering/,
    );
  });

  it('blocks use case execution on the server', async () => {
    const { enableServerGuard } = await import('./serverGuard');
    const { UseCase } = await import('./useCase');
    enableServerGuard();

    class Load extends UseCase<{ v: number }> {
      protected isAppStateInitialized() {
        return true;
      }
      protected async initializeState() {
        return { v: 1 };
      }
      protected async runLogic() {}
    }

    // Must reject rather than resolve false — execute() reports ordinary
    // failures as `false`, which would hide the guard.
    await expect(new Load().execute()).rejects.toThrow(/server-side rendering/);
  });

  it('blocks presenter construction on the server', async () => {
    const { enableServerGuard } = await import('./serverGuard');
    const { Presenter } = await import('../ui/Presenter');
    enableServerGuard();

    class P extends Presenter<{ a: number }> {
      protected createModel() {
        return { a: 1 };
      }
    }

    expect(() => new P()).toThrow(/Constructing a Presenter/);
  });

  it('still allows use cases and presenters when the guard is off', async () => {
    const { UseCase } = await import('./useCase');
    const { Presenter } = await import('../ui/Presenter');

    class Load extends UseCase<{ v: number }> {
      protected isAppStateInitialized() {
        return true;
      }
      protected async initializeState() {
        return { v: 1 };
      }
      protected async runLogic() {}
    }
    class P extends Presenter<{ a: number }> {
      protected createModel() {
        return { a: 1 };
      }
    }

    await expect(new Load().execute()).resolves.toBe(true);
    expect(() => new P()).not.toThrow();
  });
});
