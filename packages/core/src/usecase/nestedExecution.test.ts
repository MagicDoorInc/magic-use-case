import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createScope, currentScope, onError, onNavigation, setScopeResolver } from './appScope';
import { UseCase, createUseCase } from './useCase';

beforeEach(() => {
  // A scope of its own, which is all these tests needed the module graph rebuilt for.
  const scope = createScope();
  setScopeResolver(() => scope);
});

class AppState {
  count = 0;
  failed = false;
}

function load() {
  return { UseCase, createUseCase, onError, onNavigation, currentScope };
}

type Core = Awaited<ReturnType<typeof load>>;

class InnerFailure extends Error {}
class OuterFailure extends Error {}

function baseFor(core: Core, state: AppState) {
  abstract class Base extends core.UseCase<AppState> {
    protected async initializeState() {
      return state;
    }
    peek() {
      return this.getState();
    }
  }
  return Base;
}

describe('a run nested inside another', () => {
  it('announces nothing itself, leaving one state change for the whole nest', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const changes = vi.fn();
    core.currentScope().emitter.registerForStateChange(changes);

    class Inner extends Base {
      protected async runLogic() {
        this.getState().count += 1;
      }
    }
    class Outer extends Base {
      protected async runLogic() {
        await new Inner().execute();
        await new Inner().execute();
        this.getState().count += 1;
      }
    }

    await core.createUseCase(Outer).execute();

    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('still navigates, since only state changes are held back', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const wentTo: string[] = [];
    core.onNavigation((url) => wentTo.push(url));

    class Inner extends Base {
      protected async runLogic() {
        this.navigate('/signin');
      }
    }
    class Outer extends Base {
      protected async runLogic() {
        await new Inner().execute();
      }
    }

    await core.createUseCase(Outer).execute();

    expect(wentTo).toEqual(['/signin']);
  });

  it('aborts its caller when it fails', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    let reachedTheRest = false;
    // stands in for the app's ErrorHandler, so the failure is heard
    core.onError(() => undefined);

    class Inner extends Base {
      protected async runLogic() {
        throw new InnerFailure('inner');
      }
    }
    class Outer extends Base {
      protected async runLogic() {
        await new Inner().execute();
        reachedTheRest = true;
      }
    }

    await expect(core.createUseCase(Outer).execute()).rejects.toBeInstanceOf(InnerFailure);
    expect(reachedTheRest).toBe(false);
  });
});

describe('reporting a failure', () => {
  it('happens once, at the outermost run, however deep the failure was', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const reported: Error[] = [];
    core.onError((error) => reported.push(error));

    class Inner extends Base {
      protected async runLogic() {
        throw new InnerFailure('inner');
      }
    }
    class Middle extends Base {
      protected async runLogic() {
        await new Inner().execute();
      }
    }
    class Outer extends Base {
      protected async runLogic() {
        await new Middle().execute();
      }
    }

    await expect(core.createUseCase(Outer).execute()).rejects.toBeInstanceOf(InnerFailure);

    expect(reported).toHaveLength(1);
    expect(reported[0]).toBeInstanceOf(InnerFailure);
  });

  it('names what the caller threw, not what it caught', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const reported: Error[] = [];
    core.onError((error) => reported.push(error));

    class Inner extends Base {
      protected async runLogic() {
        throw new InnerFailure('inner');
      }
    }
    class Outer extends Base {
      protected async runLogic() {
        try {
          await new Inner().execute();
        } catch (error) {
          if (error instanceof InnerFailure) throw new OuterFailure('outer');
          throw error;
        }
      }
    }

    await expect(core.createUseCase(Outer).execute()).rejects.toBeInstanceOf(OuterFailure);

    expect(reported).toHaveLength(1);
    expect(reported[0]).toBeInstanceOf(OuterFailure);
  });

  it('says nothing at all when the caller handles the failure', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const reported: Error[] = [];
    core.onError((error) => reported.push(error));

    class Inner extends Base {
      protected async runLogic() {
        throw new InnerFailure('inner');
      }
    }
    class Outer extends Base {
      protected async runLogic() {
        try {
          await new Inner().execute();
        } catch {
          this.getState().count = -1;
        }
      }
    }

    const outer = core.createUseCase(Outer) as InstanceType<typeof Outer>;
    await outer.execute();

    expect(reported).toEqual([]);
    expect(outer.peek().count).toBe(-1);
  });

  it('is what report() is for, when the caller carries on regardless', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const reported: Error[] = [];
    core.onError((error) => reported.push(error));

    class Inner extends Base {
      protected async runLogic() {
        throw new InnerFailure('inner');
      }
    }
    class Outer extends Base {
      protected async runLogic() {
        try {
          await new Inner().execute();
        } catch (error) {
          this.report(error as Error);
        }
        this.getState().count += 1;
      }
    }

    const outer = core.createUseCase(Outer) as InstanceType<typeof Outer>;
    await outer.execute();

    expect(reported).toHaveLength(1);
    expect(reported[0]).toBeInstanceOf(InnerFailure);
    expect(outer.peek().count).toBe(1);
  });

  it('reaches the screen when bootstrapping is what failed', async () => {
    const { UseCase, createUseCase, onError } = load();
    const reported: Error[] = [];
    onError((error) => reported.push(error));

    class Load extends UseCase<AppState> {
      protected async initializeState(): Promise<AppState> {
        throw new Error('no state');
      }
      protected async runLogic() {}
    }

    await expect(createUseCase(Load).execute()).rejects.toThrow('no state');
    expect(reported).toHaveLength(1);
  });
});

describe('a run that fails partway', () => {
  it('still announces the state it wrote before it threw', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const seen: AppState[] = [];
    // stands in for the app's ErrorHandler, so the failure is heard
    core.onError(() => undefined);
    core.currentScope().emitter.registerForStateChange((state) => seen.push(state as AppState));

    class Failing extends Base {
      protected async runLogic() {
        this.getState().failed = true;
        throw new InnerFailure('inner');
      }
    }

    await expect(core.createUseCase(Failing).execute()).rejects.toBeInstanceOf(InnerFailure);

    expect(seen).toHaveLength(1);
    expect(seen[0]!.failed).toBe(true);
  });

  it('describes a thrown non-Error rather than passing it on as one', async () => {
    const core = load();
    const Base = baseFor(core, new AppState());
    const reported: Error[] = [];
    core.onError((error) => reported.push(error));

    class ThrowsAString extends Base {
      protected async runLogic() {
        throw 'just a string';
      }
    }

    await expect(core.createUseCase(ThrowsAString).execute()).rejects.toBe('just a string');

    expect(reported).toHaveLength(1);
    expect(reported[0]).toBeInstanceOf(Error);
    expect(reported[0]!.message).toBe('just a string');
  });
});
