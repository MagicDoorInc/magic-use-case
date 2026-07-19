import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deepReadonly, useCaseWritable } from './deepReadonly';

beforeEach(() => {
  vi.resetModules();
});

/**
 * The library mutates a long-lived state object in place, but nothing stops a
 * consumer from treating the data under it as immutable: hold a stable root and
 * replace whole branches with new frozen values.
 */
describe('immutable state patterns', () => {
  it('reads through a frozen root without throwing', () => {
    const frozen = Object.freeze({ nested: Object.freeze({ b: 2 }), xs: Object.freeze([1, 2]) });

    // Regression: this previously threw a TypeError from the proxy invariant
    // for non-writable, non-configurable properties.
    const ro = deepReadonly(frozen);
    expect(ro.nested.b).toBe(2);
    expect(ro.xs[0]).toBe(1);
  });

  it('reads through a frozen root via the use case view too', () => {
    const frozen = Object.freeze({ nested: Object.freeze({ b: 2 }) });

    expect(useCaseWritable(frozen).nested.b).toBe(2);
  });

  it('still proxies unfrozen branches of a partly frozen object', () => {
    const state = { frozen: Object.freeze({ a: 1 }), open: { b: 2 } };
    const ro = deepReadonly(state) as unknown as { open: { b: number } };

    // The unfrozen branch keeps its readonly wrapper.
    expect(() => {
      ro.open.b = 3;
    }).toThrow(/readonly/);
  });

  it('supports replacing a whole branch with a new frozen value inside a use case', async () => {
    const { UseCase } = await import('./useCase');

    class AppState {
      // Stable root; `tenants` is swapped wholesale rather than mutated.
      tenants: readonly string[] = Object.freeze([]);
    }
    const state = new AppState();

    class AddTenant extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic(name: unknown) {
        const current = this.getState().tenants;
        this.getState().tenants = Object.freeze([...current, name as string]);
      }
    }

    await expect(new AddTenant().execute('alice')).resolves.toBe(true);
    expect(state.tenants).toEqual(['alice']);
    expect(Object.isFrozen(state.tenants)).toBe(true);
  });

  it('still refuses a branch replacement made outside a use case', async () => {
    const { UseCase } = await import('./useCase');

    class AppState {
      tenants: readonly string[] = Object.freeze([]);
    }
    const state = new AppState();

    class Noop extends UseCase<AppState> {
      protected isAppStateInitialized() {
        return false;
      }
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {}
      escape() {
        return this.getState();
      }
    }

    const uc = new Noop();
    await uc.execute();

    expect(() => {
      uc.escape().tenants = Object.freeze(['mallory']);
    }).toThrow(/outside a use case/);
    expect(state.tenants).toEqual([]);
  });

  it('gives presenters a new identity per replacement, so change detection works', () => {
    const first = Object.freeze([1]);
    const second = Object.freeze([1, 2]);
    const state = { xs: first as readonly number[] };

    const before = deepReadonly(state).xs;
    state.xs = second;
    const after = deepReadonly(state).xs;

    expect(before).not.toBe(after);
    expect(after).toEqual([1, 2]);
  });
});
