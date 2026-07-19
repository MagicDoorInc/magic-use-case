import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

class AppState {
  constructor(public origin = 'first') {}
  tenants: string[] = [];
}

async function load() {
  const { UseCase, createUseCase } = await import('./useCase');
  const { Presenter } = await import('../ui/Presenter');
  return { UseCase, createUseCase, Presenter };
}

describe('resetAppState', () => {
  it('clears state so the next execution bootstraps again', async () => {
    const { UseCase, createUseCase } = await load();
    let bootstraps = 0;

    class Base extends UseCase<AppState> {
      protected async initializeState() {
        bootstraps += 1;
        return new AppState(`boot-${bootstraps}`);
      }
      protected async runLogic() {}
      peek() {
        return this.getState();
      }
    }
    class Reset extends Base {
      protected async runLogic() {
        this.resetAppState();
      }
    }

    const first = createUseCase(Base) as InstanceType<typeof Base>;
    await first.execute();
    expect(first.peek().origin).toBe('boot-1');

    await createUseCase(Reset).execute();

    const second = createUseCase(Base) as InstanceType<typeof Base>;
    await second.execute();
    expect(second.peek().origin).toBe('boot-2');
    expect(bootstraps).toBe(2);
  });

  it('stops the emitter replaying pre-reset state to a new presenter', async () => {
    const { UseCase, createUseCase, Presenter } = await load();
    const seen: Array<string | undefined> = [];

    class Base extends UseCase<AppState> {
      protected async initializeState() {
        return new AppState('before-reset');
      }
      protected async runLogic() {}
    }
    class Reset extends Base {
      protected async runLogic() {
        this.resetAppState();
      }
    }
    class P extends Presenter<{ origin: string }> {
      protected createModel(raw: unknown) {
        return raw ? { origin: (raw as AppState).origin } : undefined;
      }
    }

    await createUseCase(Base).execute();
    await createUseCase(Reset).execute();

    // A presenter created after the reset must not inherit the old state.
    const late = new P();
    late.subscribe((model) => seen.push(model?.origin));

    expect(seen).toEqual([undefined]);
  });

  it('notifies existing presenters so the UI clears', async () => {
    const { UseCase, createUseCase, Presenter } = await load();
    const models: Array<string | undefined> = [];

    class Base extends UseCase<AppState> {
      protected async initializeState() {
        return new AppState('live');
      }
      protected async runLogic() {}
    }
    class Reset extends Base {
      protected async runLogic() {
        this.resetAppState();
      }
    }
    class P extends Presenter<{ origin: string }> {
      protected createModel(raw: unknown) {
        return raw ? { origin: (raw as AppState).origin } : undefined;
      }
    }

    const p = new P();
    p.subscribe((m) => models.push(m?.origin));

    await createUseCase(Base).execute();
    await createUseCase(Reset).execute();

    expect(models).toContain('live');
    expect(models[models.length - 1]).toBeUndefined();
  });

  it('clears the in-flight dedup map', async () => {
    const { UseCase, createUseCase } = await load();
    let runs = 0;

    class Base extends UseCase<AppState> {
      protected async initializeState() {
        return new AppState();
      }
      protected async runLogic() {
        runs += 1;
      }
    }
    class Reset extends Base {
      protected async runLogic() {
        this.resetAppState();
      }
    }

    await createUseCase(Base).execute();
    await createUseCase(Reset).execute();
    await createUseCase(Base).execute();

    // Two Base runs plus the reset; nothing was deduped against a stale entry.
    expect(runs).toBe(2);
  });

  it('refuses to run outside a use case', async () => {
    const { UseCase, createUseCase } = await load();

    class Escape extends UseCase<AppState> {
      protected async initializeState() {
        return new AppState();
      }
      protected async runLogic() {}
      // Deliberately exposed, as a careless subclass might.
      resetFromOutside() {
        this.resetAppState();
      }
    }

    const uc = createUseCase(Escape) as InstanceType<typeof Escape>;
    await uc.execute();

    expect(() => uc.resetFromOutside()).toThrow(/only allowed inside a running use case/);
  });

  it('is not reachable from the public API', async () => {
    const core = await import('../index');

    expect(Object.keys(core)).not.toContain('resetAppState');
    // It is protected, so it is absent from an instance's own enumerable keys
    // and only callable from within a subclass.
    expect('resetAppState' in core).toBe(false);
  });
});
