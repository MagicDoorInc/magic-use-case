import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

class AppState {
  tenants: string[] = [];
  meta: { count: number } = { count: 0 };
}

async function load() {
  const { UseCase, createUseCase } = await import('../usecase/useCase');
  const { Presenter } = await import('./Presenter');
  const { isMutationWindowOpen } = await import('../usecase/mutationWindow');
  return { UseCase, createUseCase, Presenter, isMutationWindowOpen };
}

describe('presenters cannot modify application state', () => {
  it('receives a readonly view and throws on any write', async () => {
    const { UseCase, createUseCase, Presenter } = await load();
    const state = new AppState();
    const attempts: string[] = [];

    class Load extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        this.getState().tenants.push('alice');
      }
    }

    class Evil extends Presenter<{ n: number }> {
      protected createModel(raw: unknown) {
        const s = raw as AppState;
        for (const [name, write] of [
          ['assign', () => (s.meta.count = 99)],
          ['push', () => s.tenants.push('mallory')],
          ['delete', () => delete (s as Partial<AppState>).meta],
        ] as Array<[string, () => unknown]>) {
          try {
            write();
            attempts.push(`${name}:ALLOWED`);
          } catch {
            attempts.push(`${name}:blocked`);
          }
        }
        return { n: s.tenants.length };
      }
    }

    new Evil();
    await createUseCase(Load).execute();

    expect(attempts).toEqual(['assign:blocked', 'push:blocked', 'delete:blocked']);
    expect(state.meta.count).toBe(0);
    expect(state.tenants).toEqual(['alice']);
  });

  it('is blocked even while a nested use case leaves the mutation window open', async () => {
    const { UseCase, createUseCase, Presenter, isMutationWindowOpen } = await load();
    const state = new AppState();
    // createModel runs once per emit — Inner's and then Outer's — so every
    // notification is recorded rather than only the last.
    const observations: Array<{ windowOpen: boolean; writeAllowed: boolean }> = [];

    class Inner extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return true;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        this.getState().meta.count += 1;
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
        // Inner emits a state change while Outer's window is still open.
        await createUseCase(Inner).execute();
      }
    }

    class Watcher extends Presenter<{ n: number }> {
      protected createModel(raw: unknown) {
        const s = raw as AppState;
        const windowOpen = isMutationWindowOpen();
        let writeAllowed: boolean;
        try {
          s.meta.count = 12345;
          writeAllowed = true;
        } catch {
          writeAllowed = false;
        }
        observations.push({ windowOpen, writeAllowed });
        return { n: s.meta.count };
      }
    }

    new Watcher();
    await createUseCase(Outer).execute();

    // The nested emit lands while the outer window is still open, so the
    // mutation window is not what protects state here — the readonly view is.
    expect(observations.some((o) => o.windowOpen)).toBe(true);
    expect(observations.every((o) => !o.writeAllowed)).toBe(true);
    expect(state.meta.count).toBe(1);
  });

  it('cannot mutate state through the model it returns', async () => {
    const { UseCase, createUseCase, Presenter } = await load();
    const state = new AppState();
    let model: { tenants: string[] } | undefined;

    class Load extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        this.getState().tenants.push('alice');
      }
    }

    class P extends Presenter<{ tenants: string[] }> {
      protected createModel(raw: unknown) {
        // Passes the state's own array straight through to the view.
        return { tenants: (raw as AppState).tenants };
      }
    }

    const p = new P();
    p.subscribe((m) => {
      model = m;
    });
    await createUseCase(Load).execute();

    expect(model?.tenants).toEqual(['alice']);
    // The array handed to the view is still the readonly proxy.
    expect(() => model!.tenants.push('mallory')).toThrow(/readonly/);
    expect(state.tenants).toEqual(['alice']);
  });

  it('KNOWN GAP: a presenter closing over the raw state object can still write', async () => {
    const { UseCase, createUseCase, Presenter } = await load();
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

    class Sneaky extends Presenter<{ n: number }> {
      protected createModel() {
        // Not the delivered view — the module-level object the consumer built.
        state.meta.count = 7;
        return { n: state.meta.count };
      }
    }

    new Sneaky();
    await createUseCase(Load).execute();

    expect(state.meta.count).toBe(7);
  });
});
