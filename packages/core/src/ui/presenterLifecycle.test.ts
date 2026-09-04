import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createScope, currentScope, setScopeResolver } from '../usecase/appScope';
import { UseCase, createUseCase } from '../usecase/useCase';
import { Presenter } from './Presenter';
import { releaseSource } from './presentationSource';

beforeEach(() => {
  // A scope of its own, which is all these tests needed the module graph rebuilt for.
  const scope = createScope();
  setScopeResolver(() => scope);
});

afterEach(() => {
  vi.useRealTimers();
});

class AppState {
  count = 0;
}

function load() {
  return { UseCase, createUseCase, Presenter, eventEmitter: currentScope().emitter };
}

type Core = Awaited<ReturnType<typeof load>>;

// Emits a state change the way the app does: through a use case.
async function bump({ UseCase, createUseCase }: Core, state: AppState) {
  class Bump extends UseCase<AppState> {
    protected async initializeState() {
      return state;
    }
    protected async runLogic() {
      this.getState().count += 1;
    }
  }
  await createUseCase(Bump).execute();
}

const countPresentation = (raw: unknown) => ({ n: (raw as AppState).count });

describe('a presenter built from a presentation', () => {
  it('catches up on state that already exists when it is constructed', async () => {
    const core = load();
    const state = new AppState();
    await bump(core, state);

    let model: unknown;
    new core.Presenter(countPresentation).subscribe((m) => {
      model = m;
    });

    expect(model).toEqual({ n: 1 });
  });

  it('delivers the model to a new subscriber exactly once', async () => {
    const core = load();
    const state = new AppState();
    await bump(core, state);

    const listener = vi.fn();
    new core.Presenter(countPresentation).subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ n: 1 });
  });

  it('reruns the presentation on every later state change', async () => {
    const core = load();
    const state = new AppState();
    await bump(core, state);

    const seen: unknown[] = [];
    new core.Presenter(countPresentation).subscribe((m) => seen.push(m));

    await bump(core, state);
    await bump(core, state);

    expect(seen).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it('shares one presentation between independent presenters', async () => {
    const core = load();
    const state = new AppState();

    const first: unknown[] = [];
    const second: unknown[] = [];
    new core.Presenter(countPresentation).subscribe((m) => first.push(m));
    new core.Presenter(countPresentation).subscribe((m) => second.push(m));

    await bump(core, state);

    expect(first).toEqual([undefined, { n: 1 }]);
    expect(second).toEqual([undefined, { n: 1 }]);
  });
});

describe('a destroyed presenter', () => {
  it('never runs its presentation again, with no deferred work left behind', async () => {
    vi.useFakeTimers();
    const core = load();
    const state = new AppState();
    await bump(core, state);

    const present = vi.fn(countPresentation);
    const presenter = new core.Presenter(present);
    presenter.subscribe(() => {});
    expect(present).toHaveBeenCalledTimes(1);

    presenter.destroy();
    await bump(core, state);
    // Nothing may be sitting on a timer waiting to render post-teardown state.
    vi.runAllTimers();
    await vi.runAllTimersAsync();

    expect(present).toHaveBeenCalledTimes(1);
  });

  it('has no model left for a late subscriber to read back', async () => {
    const core = load();
    const state = new AppState();
    await bump(core, state);

    const presenter = new core.Presenter(countPresentation);
    presenter.subscribe(() => {});
    presenter.destroy();

    const listener = vi.fn();
    presenter.subscribe(listener);

    expect(listener).toHaveBeenCalledWith(undefined);
  });

  it('stops running its presentation even if it was destroyed before subscribing', async () => {
    const core = load();
    const state = new AppState();

    const present = vi.fn(countPresentation);
    const presenter = new core.Presenter(present);
    presenter.destroy();

    await bump(core, state);

    expect(present).not.toHaveBeenCalled();
  });
});

describe('presenters sharing one presentation', () => {
  it('runs it once per state change, however many presenters hold it', async () => {
    const core = load();
    const state = new AppState();
    const present = vi.fn(countPresentation);

    const models: unknown[][] = [[], [], []];
    for (const seen of models) {
      new core.Presenter(present).subscribe((m) => seen.push(m));
    }
    present.mockClear();

    await bump(core, state);

    expect(present).toHaveBeenCalledTimes(1);
    for (const seen of models) {
      expect(seen[seen.length - 1]).toEqual({ n: 1 });
    }
  });

  it('hands every presenter the same model, built once', async () => {
    const core = load();
    const state = new AppState();
    await bump(core, state);

    let first: unknown;
    let second: unknown;
    new core.Presenter(countPresentation).subscribe((m) => (first = m));
    new core.Presenter(countPresentation).subscribe((m) => (second = m));

    expect(first).toBe(second);
  });

  it('keeps working for the presenters that remain when one is destroyed', async () => {
    const core = load();
    const state = new AppState();
    const present = vi.fn(countPresentation);

    const leaving = new core.Presenter(present);
    const seen: unknown[] = [];
    new core.Presenter(present).subscribe((m) => seen.push(m));

    leaving.destroy();
    present.mockClear();
    await bump(core, state);

    expect(present).toHaveBeenCalledTimes(1);
    expect(seen[seen.length - 1]).toEqual({ n: 1 });
  });

  it('starts over when a presentation is picked up again after its last presenter left', async () => {
    const core = load();
    const state = new AppState();
    await bump(core, state);

    const present = vi.fn(countPresentation);
    new core.Presenter(present).destroy();
    present.mockClear();

    let model: unknown;
    new core.Presenter(present).subscribe((m) => (model = m));

    expect(present).toHaveBeenCalledTimes(1);
    expect(model).toEqual({ n: 1 });
  });

  it('does not release a share it no longer holds when destroyed twice', async () => {
    const core = load();
    const state = new AppState();
    const present = vi.fn(countPresentation);

    const leaving = new core.Presenter(present);
    const seen: unknown[] = [];
    new core.Presenter(present).subscribe((m) => seen.push(m));

    leaving.destroy();
    leaving.destroy();
    present.mockClear();
    await bump(core, state);

    // A second release would have torn the presentation down under the
    // presenter still using it.
    expect(present).toHaveBeenCalledTimes(1);
    expect(seen[seen.length - 1]).toEqual({ n: 1 });
  });
});

describe('sharing is keyed on the presentation itself, not on its name', () => {
  // A minifier renames functions, and may leave two of them with the same name
  // or with none at all. Anything derived from `fn.name` would merge unrelated
  // presentations and miss real shares; object identity does neither.
  const rename = <T extends object>(fn: T, name: string): T => Object.defineProperty(fn, 'name', { value: name });

  it('keeps two presentations apart when minification collides their names', async () => {
    const core = load();
    const state = new AppState();

    const counts = rename(vi.fn(countPresentation), 'a');
    const doubled = rename(
      vi.fn((raw: unknown) => ({ n: (raw as AppState).count * 2 })),
      'a'
    );
    expect(counts.name).toBe(doubled.name);

    let fromCounts: unknown;
    let fromDoubled: unknown;
    new core.Presenter(counts).subscribe((m) => (fromCounts = m));
    new core.Presenter(doubled).subscribe((m) => (fromDoubled = m));

    await bump(core, state);

    expect(fromCounts).toEqual({ n: 1 });
    expect(fromDoubled).toEqual({ n: 2 });
    expect(counts).toHaveBeenCalledTimes(1);
    expect(doubled).toHaveBeenCalledTimes(1);
  });

  it('still shares a presentation whose name minification stripped', async () => {
    const core = load();
    const state = new AppState();

    const present = rename(vi.fn(countPresentation), '');
    expect(present.name).toBe('');

    const seen: unknown[] = [];
    new core.Presenter(present).subscribe((m) => seen.push(m));
    new core.Presenter(present).subscribe(() => {});
    present.mockClear();

    await bump(core, state);

    expect(present).toHaveBeenCalledTimes(1);
    expect(seen[seen.length - 1]).toEqual({ n: 1 });
  });
});

describe('when application state is reset', () => {
  it('empties the model without calling the presentation on absent state', async () => {
    const core = load();
    const state = new AppState();

    class Base extends core.UseCase<AppState> {
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {}
    }
    class Reset extends Base {
      protected async runLogic() {
        this.resetAppState();
      }
    }

    // Total in `AppState`, and never asked about anything else.
    const present = vi.fn(countPresentation);
    const seen: unknown[] = [];
    new core.Presenter(present).subscribe((m) => seen.push(m));

    await core.createUseCase(Base).execute();
    await core.createUseCase(Reset).execute();

    expect(seen[seen.length - 1]).toBeUndefined();
    expect(present.mock.calls.every(([raw]) => raw !== undefined)).toBe(true);
  });
});

describe('a presentation that throws', () => {
  it('does not fail the construction that is catching up', async () => {
    const core = load();
    const state = new AppState();
    await bump(core, state);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const listener = vi.fn();
    expect(() =>
      new core.Presenter(() => {
        throw new Error('cannot present');
      }).subscribe(listener)
    ).not.toThrow();

    expect(listener).toHaveBeenCalledWith(undefined);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('leaves the other presenters, and the use case, unaffected', async () => {
    const core = load();
    const state = new AppState();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    new core.Presenter(() => {
      throw new Error('cannot present');
    });
    const healthy: unknown[] = [];
    new core.Presenter(countPresentation).subscribe((m) => healthy.push(m));

    await expect(bump(core, state)).resolves.toBeUndefined();

    expect(healthy).toEqual([undefined, { n: 1 }]);
    spy.mockRestore();
  });

  it('empties its model rather than leaving a stale one on screen', async () => {
    const core = load();
    const state = new AppState();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let failNext = false;
    const seen: unknown[] = [];
    new core.Presenter((raw: unknown) => {
      if (failNext) throw new Error('cannot present');
      return countPresentation(raw);
    }).subscribe((m) => seen.push(m));

    await bump(core, state);
    failNext = true;
    await bump(core, state);

    expect(seen).toEqual([undefined, { n: 1 }, undefined]);
    spy.mockRestore();
  });
});

describe('the emitter', () => {
  it('does not strand a handler that throws while catching up', async () => {
    const core = load();
    const state = new AppState();
    await bump(core, state);

    const bad = vi.fn(() => {
      throw new Error('failed catching up');
    });
    expect(() => core.eventEmitter.registerForStateChange(bad)).toThrow(/failed catching up/);
    expect(bad).toHaveBeenCalledTimes(1);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await bump(core, state);

    // Still registered, it would run — and log — on every emit for the rest of
    // the session, with no reference left to unregister it.
    expect(bad).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shrugs off releasing a presentation nobody is holding', async () => {
    const neverUsed = (state: AppState) => ({ n: state.count });

    expect(() => releaseSource(currentScope(), neverUsed)).not.toThrow();
    expect(currentScope().sources.size).toBe(0);
  });
});
