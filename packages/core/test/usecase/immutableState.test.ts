import { describe, it, expect, beforeEach } from 'vitest';
import { UseCase } from '../../src/usecase/useCase';
import { createScope, setScopeResolver } from '../../src/usecase/appScope';
import { deepReadonly, useCaseWritable } from '../../src/usecase/deepReadonly';

beforeEach(() => {
  // A scope of its own, which is all these tests needed the module graph rebuilt for.
  const scope = createScope();
  setScopeResolver(() => scope);
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

  it('reads a function held by a frozen object', () => {
    const format = (n: number) => `#${n}`;
    const frozen = Object.freeze({ format, label: 'x', describe() { return this.label; } });

    expect(deepReadonly(frozen).format).toBe(format);
    expect(useCaseWritable(frozen).format(1)).toBe('#1');
    expect(deepReadonly(frozen).describe()).toBe('x');
  });

  it('reads an arrow-function field of a frozen class instance', () => {
    class Row {
      label = 'a';
      render = () => this.label;
    }
    const row = Object.freeze(new Row());

    expect(deepReadonly(row).render()).toBe('a');
    expect(useCaseWritable(row).render()).toBe('a');
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

    class AppState {
      // Stable root; `tenants` is swapped wholesale rather than mutated.
      tenants: readonly string[] = Object.freeze([]);
    }
    const state = new AppState();

    class AddTenant extends UseCase<AppState, string> {
      protected async initializeState() {
        return state;
      }
      protected async runLogic(name: string) {
        const current = this.getState().tenants;
        this.getState().tenants = Object.freeze([...current, name]);
      }
      peek() {
        return this.getState();
      }
    }

    const uc = new AddTenant();
    await expect(uc.execute('alice')).resolves.toBeUndefined();
    expect(uc.peek().tenants).toEqual(['alice']);
    expect(Object.isFrozen(uc.peek().tenants)).toBe(true);
  });

  it('explains a write the frozen object itself refuses', async () => {
    class AppState {
      settings = Object.freeze({ theme: 'dark' });
      tenants: readonly string[] = Object.freeze(['alice']);
    }
    class Edit extends UseCase<AppState> {
      protected async initializeState() {
        return new AppState();
      }
      protected async runLogic() {
        (this.getState().settings as { theme: string }).theme = 'light';
      }
    }
    class Remove extends Edit {
      protected async runLogic() {
        delete (this.getState().settings as { theme?: string }).theme;
      }
    }
    class Add extends Edit {
      protected async runLogic() {
        (this.getState().tenants as string[]).push('bob');
      }
    }

    await expect(new Edit().execute()).rejects.toThrow("Cannot set 'theme': the object is frozen");
    await expect(new Remove().execute()).rejects.toThrow("Cannot delete 'theme': the object is frozen");
    await expect(new Add().execute()).rejects.toThrow('Cannot call .push() on an array: the object is frozen');
  });

  it('still refuses a branch replacement made outside a use case', async () => {

    class AppState {
      tenants: readonly string[] = Object.freeze([]);
    }
    const state = new AppState();

    class Noop extends UseCase<AppState> {
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
    expect(uc.escape().tenants).toEqual([]);
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
