import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

class AppState {
  tenants: string[] = [];
  meta: { count: number } = { count: 0 };
}

async function load() {
  const { UseCase } = await import('./useCase');
  const { useCaseWritable } = await import('./deepReadonly');
  return { UseCase, useCaseWritable };
}

describe('state mutation is confined to use cases', () => {
  it('allows writes from inside runLogic', async () => {
    const { UseCase } = await load();
    const state = new AppState();

    class Load extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        this.getState().tenants.push('alice');
        this.getState().meta.count = 1;
      }
    }

    await expect(new Load().execute()).resolves.toBe(true);
    expect(state.tenants).toEqual(['alice']);
    expect(state.meta.count).toBe(1);
  });

  it('rejects writes through a state reference held outside a use case', async () => {
    const { UseCase, useCaseWritable } = await load();
    const state = new AppState();

    class Load extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {}
      // Leak the guarded view, as a component might if handed one.
      escape() {
        return this.getState();
      }
    }

    const uc = new Load();
    await uc.execute();
    const escaped = uc.escape();

    // The window has closed, so the same object now refuses writes.
    expect(() => {
      escaped.meta.count = 99;
    }).toThrow(/outside a use case/);
    expect(() => escaped.tenants.push('mallory')).toThrow(/outside a use case/);
    expect(state.meta.count).toBe(0);

    // And a freshly wrapped view behaves the same: reads fine, writes throw.
    expect(useCaseWritable(state).tenants.length).toBe(0);
    expect(() => {
      useCaseWritable(state).meta.count = 5;
    }).toThrow(/outside a use case/);
  });

  it('closes the window even when runLogic throws', async () => {
    const { UseCase, useCaseWritable } = await load();
    const state = new AppState();

    class Failing extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        throw new Error('boom');
      }
    }

    await new Failing().execute();

    expect(() => {
      useCaseWritable(state).meta.count = 1;
    }).toThrow(/outside a use case/);
  });

  it('keeps the window open for the outer use case when they nest', async () => {
    const { UseCase, useCaseWritable } = await load();
    const state = new AppState();
    let innerRan = false;

    class Inner extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return true;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        innerRan = true;
      }
    }

    class Outer extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        await new Inner().execute();
        // The inner use case finishing must not have closed our window.
        this.getState().meta.count = 7;
      }
    }

    await expect(new Outer().execute()).resolves.toBe(true);
    expect(innerRan).toBe(true);
    expect(state.meta.count).toBe(7);
    expect(() => {
      useCaseWritable(state).meta.count = 8;
    }).toThrow(/outside a use case/);
  });

  it('KNOWN GAP: the raw object is still writable, bypassing the proxy', async () => {
    const { UseCase } = await load();
    const state = new AppState();

    class Load extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {}
    }

    await new Load().execute();

    // The consumer constructed `state`, so they hold the unproxied object. The
    // guard cannot see writes made through it, and no state-change event fires.
    state.meta.count = 42;
    expect(state.meta.count).toBe(42);
  });

  it('KNOWN GAP: an await in runLogic leaves the window open to other code', async () => {
    const { UseCase, useCaseWritable } = await load();
    const state = new AppState();
    let observedDuringAwait: string | undefined;

    class Slow extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    // Probe partway through runLogic's await, once the window is genuinely
    // open. (Probing synchronously after execute() is too early: execute first
    // awaits initialStatePromise, before runWithUpdate opens the window.)
    const probe = new Promise<void>((resolve) =>
      setTimeout(() => {
        try {
          useCaseWritable(state).meta.count = 1;
          observedDuringAwait = 'allowed';
        } catch {
          observedDuringAwait = 'blocked';
        }
        resolve();
      }, 2),
    );

    await Promise.all([new Slow().execute(), probe]);

    expect(observedDuringAwait).toBe('allowed');
  });
});
