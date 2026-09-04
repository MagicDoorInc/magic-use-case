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
      protected async initializeState() {
        return { v: 1 };
      }
      protected async runLogic() {}
    }

    // The guard is a programming error, not a domain failure: it is raised
    // before the run begins, so it reaches the caller without being reported.
    await expect(new Load().execute()).rejects.toThrow(/server-side rendering/);
  });

  it('blocks presenter construction on the server', async () => {
    const { enableServerGuard } = await import('./serverGuard');
    const { Presenter } = await import('../ui/Presenter');
    enableServerGuard();

    expect(() => new Presenter(() => ({ a: 1 }))).toThrow(/Constructing a Presenter/);
  });

  it('still allows use cases and presenters when the guard is off', async () => {
    const { UseCase } = await import('./useCase');
    const { Presenter } = await import('../ui/Presenter');

    class Load extends UseCase<{ v: number }> {
      protected async initializeState() {
        return { v: 1 };
      }
      protected async runLogic() {}
    }
    await expect(new Load().execute()).resolves.toBeUndefined();
    expect(() => new Presenter(() => ({ a: 1 }))).not.toThrow();
  });
});
