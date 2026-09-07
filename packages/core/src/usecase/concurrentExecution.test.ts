import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createScope, currentScope, setScopeResolver } from './appScope';
import { UseCase, createUseCase } from './useCase';

class AppState {
  leases: string[] = [];
  chats: string[] = [];
}

/** Held open so "while the other one is still running" is a settled moment, not a race. */
let held: Promise<void>;
let release: () => void;
let neverEnds: Promise<void>;
let endIt: () => void;

beforeEach(() => {
  const scope = createScope();
  setScopeResolver(() => scope);
  held = new Promise<void>((resolve) => {
    release = resolve;
  });
  neverEnds = new Promise<void>((resolve) => {
    endIt = resolve;
  });
});

const eventually = (assertion: () => void) => vi.waitFor(assertion, { timeout: 1000, interval: 1 });

const baseFor = (state: AppState) => {
  abstract class Base extends UseCase<AppState> {
    protected async initializeState() {
      return state;
    }
  }
  return Base;
};

/**
 * Two flows a screen starts independently: a long initialization, and the page's
 * own fetch finishing underneath it. Neither is the other's caller, so neither
 * should be waiting on the other to be shown.
 */
describe('a run finishing while an unrelated run is still going', () => {
  it('announces its own work rather than waiting for the other to finish', async () => {
    const state = new AppState();
    const Base = baseFor(state);
    const announced: string[][] = [];
    currentScope().emitter.registerForStateChange((s) => announced.push([...(s as AppState).leases]));

    class InitializeApp extends Base {
      protected async runLogic() {
        await held;
        this.getState().chats = ['chat-1'];
      }
    }

    class GetLeases extends Base {
      protected async runLogic() {
        this.getState().leases = ['lease-1'];
      }
    }

    const initializing = createUseCase(InitializeApp).execute();
    await createUseCase(GetLeases).execute();

    // The screen is told about the leases now, not when the initialization lands.
    expect(announced).toEqual([['lease-1']]);

    release();
    await initializing;
  });

  it('still leaves a nested run silent, so a caller announces once for its whole nest', async () => {
    const state = new AppState();
    const Base = baseFor(state);
    const announced: string[][] = [];
    currentScope().emitter.registerForStateChange((s) => announced.push([...(s as AppState).leases]));

    class GetLeases extends Base {
      protected async runLogic() {
        this.getState().leases = ['lease-1'];
      }
    }

    class InitializeApp extends Base {
      protected async runLogic() {
        await new GetLeases().execute();
        this.getState().leases = [...this.getState().leases, 'lease-2'];
      }
    }

    await createUseCase(InitializeApp).execute();

    await eventually(() => expect(announced).toEqual([['lease-1', 'lease-2']]));
  });

  it('tells the screen when it joins a run already in flight rather than starting its own', async () => {
    const state = new AppState();
    const Base = baseFor(state);
    const announced: string[][] = [];
    currentScope().emitter.registerForStateChange((s) => announced.push([...(s as AppState).leases]));

    let started: () => void;
    const hasStarted = new Promise<void>((resolve) => {
      started = resolve;
    });

    class GetLeases extends Base {
      protected async runLogic() {
        started();
        await held;
        this.getState().leases = ['lease-1'];
      }
    }

    class InitializeApp extends Base {
      protected async runLogic() {
        // Nested, so it stays quiet and leaves the announcing to its caller —
        // which is still running when the screen's own request lands.
        await new GetLeases().execute();
        await neverEnds;
      }
    }

    const initializing = createUseCase(InitializeApp).execute();
    await hasStarted;

    // The screen asks for the same thing, and joins the run already going.
    const joining = createUseCase(GetLeases).execute();
    release();
    await joining;

    expect(announced).toEqual([['lease-1']]);

    endIt();
    await initializing;
  });
});
