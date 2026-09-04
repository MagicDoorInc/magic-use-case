import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AppScope } from './appScope';

beforeEach(() => {
  vi.resetModules();
});

class AppState {
  constructor(public origin: string) {}
  count = 0;
}

async function load() {
  const { UseCase, createUseCase } = await import('./useCase');
  const { createScope, currentScope, setScopeResolver } = await import('./appScope');
  const { Presenter } = await import('../ui/Presenter');
  const { isMutationWindowOpen } = await import('./mutationWindow');
  return {
    UseCase,
    createUseCase,
    // The library's own tests look inside a scope; consumers only ever hold the handle.
    createScope: (initialState?: unknown) => createScope(initialState) as AppScope,
    currentScope,
    setScopeResolver,
    Presenter,
    isMutationWindowOpen,
  };
}

type Core = Awaited<ReturnType<typeof load>>;

const present = (raw: unknown) => ({ origin: (raw as AppState).origin, count: (raw as AppState).count });

function useCaseFor(core: Core, origin: string) {
  class Load extends core.UseCase<AppState> {
    protected async initializeState() {
      return new AppState(origin);
    }
    protected async runLogic() {
      this.getState().count += 1;
    }
  }
  return Load;
}

describe('the application scope', () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it('is a single one for a browser, resolved without installing anything', async () => {
    const core = await load();
    expect(core.currentScope()).toBe(core.currentScope());
  });

  it('keeps two scopes from seeing each other, in state and in models', async () => {
    const core = await load();
    const first = core.createScope();
    const second = core.createScope();
    let active = first;
    core.setScopeResolver(() => active);

    const firstModels: unknown[] = [];
    const secondModels: unknown[] = [];

    // Each scope bootstraps its own state and builds its own model, from one
    // presentation function shared between them.
    active = first;
    new core.Presenter(present).subscribe((m) => firstModels.push(m));
    await core.createUseCase(useCaseFor(core, 'first')).execute();

    active = second;
    new core.Presenter(present).subscribe((m) => secondModels.push(m));
    await core.createUseCase(useCaseFor(core, 'second')).execute();
    await core.createUseCase(useCaseFor(core, 'second')).execute();

    expect(first.state).toEqual({ origin: 'first', count: 1 });
    expect(second.state).toEqual({ origin: 'second', count: 2 });
    expect(firstModels[firstModels.length - 1]).toEqual({ origin: 'first', count: 1 });
    expect(secondModels[secondModels.length - 1]).toEqual({ origin: 'second', count: 2 });

    // The presentation is shared by identity, but each scope holds its own
    // source for it — a model built in one is never handed to the other.
    expect(first.sources.get(present)).toBeDefined();
    expect(second.sources.get(present)).toBeDefined();
    expect(first.sources.get(present)).not.toBe(second.sources.get(present));
  });

  it('does not let one scope\'s running use case make another\'s state writable', async () => {
    const core = await load();
    const busy = core.createScope();
    const idle = core.createScope();
    let active = busy;
    core.setScopeResolver(() => active);

    let openElsewhere: boolean | undefined;

    class Slow extends core.UseCase<AppState> {
      protected async initializeState() {
        return new AppState('busy');
      }
      protected async runLogic() {
        // Another scope asks, while this one is mid-write.
        active = idle;
        openElsewhere = core.isMutationWindowOpen();
        active = busy;
      }
    }

    await core.createUseCase(Slow).execute();

    expect(openElsewhere).toBe(false);
  });

  it('releases a presenter\'s share from the scope it acquired in', async () => {
    const core = await load();
    const first = core.createScope();
    const second = core.createScope();
    let active = first;
    core.setScopeResolver(() => active);

    const presenter = new core.Presenter(present);
    expect(first.sources.size).toBe(1);

    // Torn down while a different scope is current, as a component cleanup
    // running outside its request would be.
    active = second;
    presenter.destroy();

    expect(first.sources.size).toBe(0);
    expect(second.sources.size).toBe(0);
  });
});
