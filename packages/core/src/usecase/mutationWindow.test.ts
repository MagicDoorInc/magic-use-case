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

    class Load extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return new AppState();
      }
      protected async runLogic() {
        this.getState().tenants.push('alice');
        this.getState().meta.count = 1;
      }
      // Application state is the adopted clone, so tests read it back here
      // rather than through the object handed to initializeState().
      peek() {
        return this.getState();
      }
    }

    const uc = new Load();
    await expect(uc.execute()).resolves.toBe(true);
    expect(uc.peek().tenants).toEqual(['alice']);
    expect(uc.peek().meta.count).toBe(1);
  });

  it('rejects writes through a state reference held outside a use case', async () => {
    const { UseCase } = await load();

    class Load extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return new AppState();
      }
      protected async runLogic() {}
      escape() {
        return this.getState();
      }
    }

    const uc = new Load();
    await uc.execute();
    const escaped = uc.escape();

    // The window has closed, so the same view now refuses writes.
    expect(() => {
      escaped.meta.count = 99;
    }).toThrow(/outside a use case/);
    expect(() => escaped.tenants.push('mallory')).toThrow(/outside a use case/);
    expect(uc.escape().meta.count).toBe(0);
  });

  it('closes the window even when runLogic throws', async () => {
    const { UseCase } = await load();

    class Failing extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return new AppState();
      }
      protected async runLogic() {
        throw new Error('boom');
      }
      peek() {
        return this.getState();
      }
    }

    const uc = new Failing();
    await uc.execute();

    expect(() => {
      uc.peek().meta.count = 1;
    }).toThrow(/outside a use case/);
  });

  it('keeps the window open for the outer use case when they nest', async () => {
    const { UseCase } = await load();
    let innerRan = false;

    class Inner extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return true;
      }
      protected async initializeState() {
        return new AppState();
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
        return new AppState();
      }
      protected async runLogic() {
        await new Inner().execute();
        // The inner use case finishing must not have closed our window.
        this.getState().meta.count = 7;
      }
      peek() {
        return this.getState();
      }
    }

    const uc = new Outer();
    await expect(uc.execute()).resolves.toBe(true);
    expect(innerRan).toBe(true);
    expect(uc.peek().meta.count).toBe(7);
    expect(() => {
      uc.peek().meta.count = 8;
    }).toThrow(/outside a use case/);
  });

  it('detaches the object given to initializeState, so later writes to it do nothing', async () => {
    const { UseCase } = await load();
    const original = new AppState();

    class Load extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return original;
      }
      protected async runLogic() {}
      peek() {
        return this.getState();
      }
    }

    const uc = new Load();
    await uc.execute();

    // Writing to the caller's own reference is legal — it is an ordinary object
    // — but it is no longer application state.
    original.meta.count = 42;
    original.tenants.push('mallory');

    expect(uc.peek().meta.count).toBe(0);
    expect(uc.peek().tenants).toEqual([]);
  });

  it('KNOWN GAP: an await in runLogic leaves the window open to other code', async () => {
    const { UseCase, useCaseWritable } = await load();
    let observedDuringAwait: string | undefined;
    let live: AppState | undefined;

    class Slow extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return new AppState();
      }
      protected async runLogic() {
        live = this.getState();
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    // Probe partway through runLogic's await, once the window is genuinely
    // open. (Probing synchronously after execute() is too early: execute first
    // awaits initialStatePromise, before runWithUpdate opens the window.)
    const probe = new Promise<void>((resolve) =>
      setTimeout(() => {
        try {
          useCaseWritable(live as object as AppState).meta.count = 1;
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
