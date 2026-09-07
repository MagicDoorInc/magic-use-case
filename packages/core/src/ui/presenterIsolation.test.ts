import { describe, it, expect, beforeEach } from 'vitest';
import { isMutationWindowOpen } from '../usecase/mutationWindow';
import { UseCase, createUseCase } from '../usecase/useCase';
import { Presenter } from './Presenter';
import { createScope, setScopeResolver } from '../usecase/appScope';

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
  return { UseCase, createUseCase, Presenter, isMutationWindowOpen };
}

describe('presenters cannot modify application state', () => {
  it('receives a readonly view and throws on any write', async () => {
    const { UseCase, createUseCase, Presenter } = load();
    const state = new AppState();
    const attempts: string[] = [];

    class Load extends UseCase<AppState> {
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        this.getState().tenants.push('alice');
      }
      peek() {
        return this.getState();
      }
    }

    const evil = (raw: unknown) => {
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
    };

    new Presenter(evil);
    const uc = createUseCase(Load) as InstanceType<typeof Load>;
    await uc.execute();

    expect(attempts).toEqual(['assign:blocked', 'push:blocked', 'delete:blocked']);
    expect(uc.peek().meta.count).toBe(0);
    expect(uc.peek().tenants).toEqual(['alice']);
  });

  it('is handed one model for a whole nest of use cases, and still cannot write to it', async () => {
    const { UseCase, createUseCase, Presenter, isMutationWindowOpen } = load();
    const state = new AppState();
    // One entry per emit. Inner has a caller and so announces nothing; the
    // whole nest produces the single emit recorded here.
    const observations: Array<{ windowOpen: boolean; writeAllowed: boolean }> = [];

    class Inner extends UseCase<AppState> {
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        this.getState().meta.count += 1;
      }
    }

    class Outer extends UseCase<AppState> {
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        // Constructed rather than created: this one has a caller, so it stays
        // quiet and Outer announces the whole nest.
        await new Inner().execute();
      }
      peek() {
        return this.getState();
      }
    }

    const watch = (raw: unknown) => {
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
    };

    new Presenter(watch);
    const outer = createUseCase(Outer) as InstanceType<typeof Outer>;
    await outer.execute();

    expect(observations).toHaveLength(1);
    // Announced once the application is quiet, so no window is open by then —
    // which leaves the readonly view as the only thing refusing the write.
    expect(observations[0]!.windowOpen).toBe(false);
    expect(observations[0]!.writeAllowed).toBe(false);
    expect(outer.peek().meta.count).toBe(1);
  });

  it('cannot mutate state through the model it returns', async () => {
    const { UseCase, createUseCase, Presenter } = load();
    const state = new AppState();
    let model: { tenants: string[] } | undefined;

    class Load extends UseCase<AppState> {
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        this.getState().tenants.push('alice');
      }
      peek() {
        return this.getState();
      }
    }

    // Passes the state's own array straight through to the view.
    const p = new Presenter((raw: unknown) => ({ tenants: (raw as AppState).tenants }));
    p.subscribe((m) => {
      model = m;
    });
    const uc = createUseCase(Load) as InstanceType<typeof Load>;
    await uc.execute();

    expect(model?.tenants).toEqual(['alice']);
    // The array handed to the view is still the readonly proxy.
    expect(() => model!.tenants.push('mallory')).toThrow(/readonly/);
    expect(uc.peek().tenants).toEqual(['alice']);
  });

  it('cannot reach state by closing over the object given to initializeState', async () => {
    const { UseCase, createUseCase, Presenter } = load();
    const state = new AppState();

    class Load extends UseCase<AppState> {
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {}
      peek() {
        return this.getState();
      }
    }

    new Presenter(() => {
      // Not the delivered view — the object the consumer built. Since it is
      // cloned on adoption, this write lands on a detached object.
      state.meta.count = 7;
      return { n: state.meta.count };
    });
    const uc = createUseCase(Load) as InstanceType<typeof Load>;
    await uc.execute();

    expect(state.meta.count).toBe(7);
    expect(uc.peek().meta.count).toBe(0);
  });
});
