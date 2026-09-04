import { describe, it, expect, beforeEach } from 'vitest';
import { UseCase } from './useCase';
import { createScope, setScopeResolver } from './appScope';
import { deepReadonly } from './deepReadonly';

beforeEach(() => {
  // A scope of its own, which is all these tests needed the module graph rebuilt for.
  const scope = createScope();
  setScopeResolver(() => scope);
});

/**
 * Neither style is mandatory. A single state tree may mutate one branch in place
 * and replace another wholesale; the library only cares that the write happens
 * inside a use case.
 */
describe('in-place and immutable styles coexist', () => {
  class AppState {
    // mutated in place
    log: string[] = [];
    counters: Map<string, number> = new Map();
    // replaced wholesale
    tenants: readonly string[] = Object.freeze([]);
    settings: Readonly<{ theme: string }> = Object.freeze({ theme: 'light' });
  }

  it('supports both styles in the same use case', async () => {
    const state = new AppState();

    class DoBoth extends UseCase<AppState> {
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {
        const s = this.getState();

        // in-place
        s.log.push('started');
        s.counters.set('runs', 1);

        // immutable replacement
        s.tenants = Object.freeze([...s.tenants, 'alice']);
        s.settings = Object.freeze({ ...s.settings, theme: 'dark' });
      }
      peek() {
        return this.getState();
      }
    }

    const uc = new DoBoth();
    await expect(uc.execute()).resolves.toBeUndefined();

    expect(uc.peek().log).toEqual(['started']);
    expect(uc.peek().counters.get('runs')).toBe(1);
    expect(uc.peek().tenants).toEqual(['alice']);
    expect(uc.peek().settings.theme).toBe('dark');
  });

  it('blocks both styles equally when outside a use case', async () => {
    const state = new AppState();

    class Escape extends UseCase<AppState> {
      protected async initializeState() {
        return state;
      }
      protected async runLogic() {}
      view() {
        return this.getState();
      }
    }

    const uc = new Escape();
    await uc.execute();
    const s = uc.view();

    expect(() => s.log.push('nope')).toThrow(/outside a use case/);
    expect(() => s.counters.set('nope', 1)).toThrow(/outside a use case/);
    expect(() => {
      s.tenants = Object.freeze(['nope']);
    }).toThrow(/outside a use case/);
  });

  it('presenters read both branches through the readonly view', () => {
    const state = new AppState();
    state.log.push('a');
    state.tenants = Object.freeze(['alice']);

    const ro = deepReadonly(state);

    expect(ro.log[0]).toBe('a');
    expect(ro.tenants[0]).toBe('alice');
    expect(() => (ro.log as unknown as string[]).push('b')).toThrow(/readonly/);
  });

  it('documents the change-detection difference between the two styles', () => {
    const state = new AppState();

    // In-place: the branch keeps its identity, so a presenter comparing
    // references sees no change and must diff structurally.
    const logBefore = deepReadonly(state).log;
    state.log.push('a');
    const logAfter = deepReadonly(state).log;
    expect(logAfter).toBe(logBefore);

    // Immutable: a new reference each time, so reference comparison suffices.
    const tenantsBefore = deepReadonly(state).tenants;
    state.tenants = Object.freeze(['alice']);
    const tenantsAfter = deepReadonly(state).tenants;
    expect(tenantsAfter).not.toBe(tenantsBefore);
  });
});
