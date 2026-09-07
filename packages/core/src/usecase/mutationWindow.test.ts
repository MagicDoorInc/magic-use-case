import { describe, it, expect, beforeEach } from 'vitest';
import { useCaseWritable } from './deepReadonly';
import { UseCase } from './useCase';
import { createScope, setScopeResolver } from './appScope';

beforeEach(() => {
  // A scope of its own, which is all these tests needed the module graph rebuilt for.
  const scope = createScope();
  setScopeResolver(() => scope);
});

class AppState {
  tenants: string[] = [];
  meta: { count: number } = { count: 0 };
}

function load() {
  return { UseCase, useCaseWritable };
}

describe('state mutation is confined to use cases', () => {
  it('allows writes from inside runLogic', async () => {
    const { UseCase } = load();

    class Load extends UseCase<AppState> {
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
    await expect(uc.execute()).resolves.toBeUndefined();
    expect(uc.peek().tenants).toEqual(['alice']);
    expect(uc.peek().meta.count).toBe(1);
  });

  it('rejects writes through a state reference held outside a use case', async () => {
    const { UseCase } = load();

    class Load extends UseCase<AppState> {
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
    const { UseCase } = load();

    class Failing extends UseCase<AppState> {
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
    await expect(uc.execute()).rejects.toThrow('boom');

    expect(() => {
      uc.peek().meta.count = 1;
    }).toThrow(/outside a use case/);
  });

  it('keeps the window open for the outer use case when they nest', async () => {
    const { UseCase } = load();
    let innerRan = false;

    class Inner extends UseCase<AppState> {
      protected async initializeState() {
        return new AppState();
      }
      protected async runLogic() {
        innerRan = true;
      }
    }

    class Outer extends UseCase<AppState> {
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
    await expect(uc.execute()).resolves.toBeUndefined();
    expect(innerRan).toBe(true);
    expect(uc.peek().meta.count).toBe(7);
    expect(() => {
      uc.peek().meta.count = 8;
    }).toThrow(/outside a use case/);
  });

  it('detaches the object given to initializeState, so later writes to it do nothing', async () => {
    const { UseCase } = load();
    const original = new AppState();

    class Load extends UseCase<AppState> {
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

  /**
   * A detached run, or one still in flight when a request ends, outlives the
   * scope it started in. Closing whichever scope happens to be current by then
   * would shut a window a live run is depending on — which is what a second
   * request, or the next test in a file, would then be blamed for.
   */
  it('closes the window on the scope it opened, not on whichever is current by then', async () => {
    const { UseCase } = load();
    let letItFinish: () => void = () => undefined;
    const heldOpen = new Promise<void>((resolve) => {
      letItFinish = resolve;
    });

    class Outliving extends UseCase<AppState> {
      protected async initializeState() {
        return new AppState();
      }
      protected async runLogic() {
        await heldOpen;
      }
    }

    const stillRunning = new Outliving().execute();
    // Let it get as far as its await, so its window is genuinely open on this
    // scope before the next one is installed.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const nextScope = createScope();
    setScopeResolver(() => nextScope);

    class Writing extends UseCase<AppState> {
      protected async initializeState() {
        return new AppState();
      }
      protected async runLogic() {
        letItFinish();
        await new Promise((resolve) => setTimeout(resolve, 0));
        this.getState().meta.count = 3;
      }
      peek() {
        return this.getState();
      }
    }

    const writing = new Writing();
    await expect(writing.execute()).resolves.toBeUndefined();
    await stillRunning;

    expect(writing.peek().meta.count).toBe(3);
  });

  it('KNOWN GAP: an await in runLogic leaves the window open to other code', async () => {
    const { UseCase, useCaseWritable } = load();
    let observedDuringAwait: string | undefined;
    let live: AppState | undefined;

    class Slow extends UseCase<AppState> {
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
