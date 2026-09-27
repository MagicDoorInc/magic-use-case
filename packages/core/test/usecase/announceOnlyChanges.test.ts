import { describe, it, expect, beforeEach } from 'vitest';
import { createScope, currentScope, setScopeResolver } from '../../src/usecase/appScope';
import { UseCase, createUseCase } from '../../src/usecase/useCase';

class AppState {
  count = 0;
  list: number[] = [];
  byId = new Map<string, number>();
  flags: Record<string, boolean> = { a: true };
}

let announcements: number;

beforeEach(() => {
  const scope = createScope();
  setScopeResolver(() => scope);
  announcements = 0;
});

const listen = () => currentScope().emitter.registerForStateChange(() => (announcements += 1));

abstract class Base<P = void> extends UseCase<AppState, P> {
  protected async initializeState() {
    return new AppState();
  }
}

class Read extends Base {
  protected async runLogic() {
    void this.getState().count;
  }
}

class Bump extends Base {
  protected async runLogic() {
    this.getState().count += 1;
  }
}

async function bootstrapped() {
  await createUseCase(Read).execute();
  listen();
  announcements = 0;
}

describe('a run announces only when it changed state', () => {
  it('announces the first run, which brings state into being', async () => {
    listen();
    await createUseCase(Read).execute();

    expect(announcements).toBe(1);
  });

  it('stays quiet when a run only read', async () => {
    await bootstrapped();
    await createUseCase(Read).execute();

    expect(announcements).toBe(0);
  });

  it('stays quiet when a run wrote back the value already there', async () => {
    class Same extends Base {
      protected async runLogic() {
        const state = this.getState();
        const { count } = state;
        state.count = count;
      }
    }
    await bootstrapped();
    await createUseCase(Same).execute();

    expect(announcements).toBe(0);
  });

  it('announces assignments, deletions and collection changes', async () => {
    class Assign extends Base {
      protected async runLogic() {
        this.getState().count = 5;
      }
    }
    class Push extends Base {
      protected async runLogic() {
        this.getState().list.push(1);
      }
    }
    class Put extends Base {
      protected async runLogic() {
        this.getState().byId.set('a', 1);
      }
    }
    class Remove extends Base {
      protected async runLogic() {
        delete this.getState().flags.a;
      }
    }
    await bootstrapped();
    for (const UseCaseClass of [Assign, Push, Put, Remove]) await createUseCase(UseCaseClass).execute();

    expect(announcements).toBe(4);
  });

  it('announces changes made by methods of what state holds', async () => {
    class Cart {
      items: string[] = [];
      add(item: string) {
        this.items.push(item);
      }
    }
    class WithCart extends AppState {
      cart = new Cart();
      due = new Date(0);
    }
    abstract class CartBase extends UseCase<WithCart> {
      protected async initializeState() {
        return new WithCart();
      }
    }
    class Look extends CartBase {
      protected async runLogic() {
        void this.getState().cart.items.includes('x');
      }
    }
    class Add extends CartBase {
      protected async runLogic() {
        this.getState().cart.add('x');
      }
    }
    class Reschedule extends CartBase {
      protected async runLogic() {
        this.getState().due.setHours(9);
      }
    }
    await createUseCase(Look).execute();
    listen();
    announcements = 0;

    await createUseCase(Look).execute();
    expect(announcements).toBe(0);
    await createUseCase(Add).execute();
    await createUseCase(Reschedule).execute();
    expect(announcements).toBe(2);
  });

  it('announces a flow whose nested run did the writing', async () => {
    class Flow extends Base {
      protected async runLogic() {
        await new Read().execute();
        await new Bump().execute();
      }
    }
    await bootstrapped();
    await createUseCase(Flow).execute();

    expect(announcements).toBe(1);
  });

  it('announces a caller that joined a run which wrote', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    class Slow extends Base {
      protected async runLogic() {
        await held;
        this.getState().count += 1;
      }
    }
    class Flow extends Base {
      protected async runLogic() {
        await new Slow().execute();
      }
    }
    await bootstrapped();
    const flow = createUseCase(Flow).execute();
    const joined = createUseCase(Slow).execute();
    release();
    await Promise.all([flow, joined]);

    expect(announcements).toBe(2);
  });

  it('announces a reset', async () => {
    class Reset extends Base {
      protected async runLogic() {
        this.resetAppState();
      }
    }
    await bootstrapped();
    await createUseCase(Reset).execute();

    expect(announcements).toBeGreaterThan(0);
  });
});
