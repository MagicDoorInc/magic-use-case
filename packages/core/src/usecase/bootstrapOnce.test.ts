import { describe, it, expect, beforeEach } from 'vitest';
import { UseCase, createUseCase } from './useCase';
import { createScope, setScopeResolver } from './appScope';

beforeEach(() => {
  // A scope of its own, which is all these tests needed the module graph rebuilt for.
  const scope = createScope();
  setScopeResolver(() => scope);
});

class AppState {
  tenants: string[] = [];
}

describe('application state bootstraps exactly once', () => {
  it('a second use case cannot replace live state', async () => {
    let bootstraps = 0;

    class Base extends UseCase<AppState> {
      protected async initializeState() {
        bootstraps += 1;
        return new AppState();
      }
      protected async runLogic() {}
      peek() {
        return this.getState();
      }
    }
    class AddTenant extends Base {
      protected async runLogic() {
        this.getState().tenants.push('alice');
      }
    }
    // Previously this wiped accumulated state, because the consumer answered
    // "not initialized" and core took it at face value.
    class Stray extends Base {
      protected async runLogic() {}
    }

    const add = createUseCase(AddTenant) as InstanceType<typeof AddTenant>;
    await add.execute();
    expect(add.peek().tenants).toEqual(['alice']);

    await createUseCase(Stray).execute();

    expect(add.peek().tenants).toEqual(['alice']);
    expect(bootstraps).toBe(1);
  });

  it('bootstraps once across concurrent first executions', async () => {
    let bootstraps = 0;

    class Base extends UseCase<AppState> {
      protected async initializeState() {
        bootstraps += 1;
        await new Promise((r) => setTimeout(r, 5));
        return new AppState();
      }
      protected async runLogic() {}
    }

    await Promise.all([
      createUseCase(Base).execute(),
      createUseCase(Base).execute(),
      createUseCase(Base).execute(),
    ]);

    expect(bootstraps).toBe(1);
  });

  it('bootstraps again only after an explicit reset', async () => {
    let bootstraps = 0;

    class Base extends UseCase<AppState> {
      protected async initializeState() {
        bootstraps += 1;
        return new AppState();
      }
      protected async runLogic() {}
    }
    class Reset extends Base {
      protected async runLogic() {
        this.resetAppState();
      }
    }

    await createUseCase(Base).execute();
    await createUseCase(Base).execute();
    expect(bootstraps).toBe(1);

    await createUseCase(Reset).execute();
    await createUseCase(Base).execute();
    expect(bootstraps).toBe(2);
  });
});
