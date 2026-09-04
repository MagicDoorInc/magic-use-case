import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createScope, currentScope, onError, setScopeResolver } from './appScope';
import { UseCase, createUseCase } from './useCase';

beforeEach(() => {
  // A scope of its own, which is all these tests needed the module graph rebuilt for.
  const scope = createScope();
  setScopeResolver(() => scope);
  openGate();
});

class AppState {
  count = 0;
}

function load() {
  return { UseCase, createUseCase, onError, currentScope };
}

type Core = Awaited<ReturnType<typeof load>>;

class DetachedFailure extends Error {}

/**
 * Detached work is held here until a test lets it through, so what happens
 * before it finishes and what happens after are two separate, settled moments
 * rather than a race against a timer.
 */
let held: Promise<void>;
let release: () => void;
const openGate = () => {
  held = new Promise<void>((resolve) => {
    release = resolve;
  });
};

/** Resolves as soon as the assertion holds, rather than after a fixed wait. */
const eventually = (assertion: () => void) => vi.waitFor(assertion, { timeout: 1000, interval: 1 });

function baseFor(core: Core, state: AppState) {
  abstract class Base extends core.UseCase<AppState> {
    protected async initializeState() {
      return state;
    }
  }
  return Base;
}

describe('a run its starter does not wait for', () => {
  it('lets the starter finish and announce its own work first', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const announced: number[] = [];
    core.currentScope().emitter.registerForStateChange((state) => announced.push((state as AppState).count));

    class Slow extends Base {
      protected async runLogic() {
        await held;
        this.getState().count = 99;
      }
    }
    class Starter extends Base {
      protected async runLogic() {
        this.detach(Slow);
        this.getState().count = 1;
      }
    }

    await core.createUseCase(Starter).execute();

    // the starter is not held open by the run it started
    expect(announced).toEqual([1]);
  });

  it('announces its own work when it lands', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const announced: number[] = [];
    core.currentScope().emitter.registerForStateChange((state) => announced.push((state as AppState).count));

    class Slow extends Base {
      protected async runLogic() {
        await held;
        this.getState().count = 99;
      }
    }
    class Starter extends Base {
      protected async runLogic() {
        this.detach(Slow);
        this.getState().count = 1;
      }
    }

    await core.createUseCase(Starter).execute();
    release();

    await eventually(() => expect(announced).toEqual([1, 99]));
  });

  it('reports its failure, since the starter is long gone and cannot', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const reported: Error[] = [];
    core.onError((error) => reported.push(error));

    class Fails extends Base {
      protected async runLogic() {
        await held;
        throw new DetachedFailure('detached');
      }
    }
    class Starter extends Base {
      protected async runLogic() {
        this.detach(Fails);
      }
    }

    await core.createUseCase(Starter).execute();
    release();

    await eventually(() => expect(reported).toHaveLength(1));
    expect(reported[0]).toBeInstanceOf(DetachedFailure);
  });

  it('keeps its failure to the error channel, rather than leaving a rejection nobody holds', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const reported: Error[] = [];
    core.onError((error) => reported.push(error));
    const unhandled: unknown[] = [];
    const note = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', note);

    class Fails extends Base {
      protected async runLogic() {
        await held;
        throw new DetachedFailure('detached');
      }
    }
    class Starter extends Base {
      protected async runLogic() {
        this.detach(Fails);
      }
    }

    try {
      await core.createUseCase(Starter).execute();
      release();
      await eventually(() => expect(reported).toHaveLength(1));
      // an unhandled rejection is flagged a tick after the failure, so give it one
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      process.off('unhandledRejection', note);
    }

    expect(unhandled).toEqual([]);
  });

  it('may still write application state, which needs a mutation window of its own', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const reported: Error[] = [];
    core.onError((error) => reported.push(error));
    const announced: number[] = [];
    core.currentScope().emitter.registerForStateChange((state) => announced.push((state as AppState).count));

    class Writes extends Base {
      protected async runLogic() {
        await held;
        this.getState().count = 42;
      }
    }
    class Starter extends Base {
      protected async runLogic() {
        this.detach(Writes);
      }
    }

    await core.createUseCase(Starter).execute();
    release();

    // without a window of its own the write throws, and the failure is reported
    await eventually(() => expect(announced).toContain(42));
    expect(reported).toEqual([]);
  });
});

describe('a failure with nobody waiting on it', () => {
  it('is reported even while an unrelated run is still going', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const reported: Error[] = [];
    core.onError((error) => reported.push(error));

    class Slow extends Base {
      protected async runLogic() {
        await held;
      }
    }
    class Fails extends Base {
      protected async runLogic() {
        throw new DetachedFailure('unrelated');
      }
    }

    const slow = core.createUseCase(Slow).execute();
    await core.createUseCase(Fails).execute().catch(() => undefined);

    // the unrelated run is still open at this point, and the failure is reported anyway
    expect(reported).toHaveLength(1);
    expect(reported[0]).toBeInstanceOf(DetachedFailure);

    release();
    await slow;
  });
});
