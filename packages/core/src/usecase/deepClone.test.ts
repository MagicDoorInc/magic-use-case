import { describe, it, expect } from 'vitest';
import { deepClone } from './deepClone';

describe('deepClone', () => {
  it('detaches the clone from the original at every depth', () => {
    const original = { a: 1, nested: { b: 2 }, xs: [1, 2] };
    const copy = deepClone(original);

    original.a = 9;
    original.nested.b = 9;
    original.xs.push(3);

    expect(copy.a).toBe(1);
    expect(copy.nested.b).toBe(2);
    expect(copy.xs).toEqual([1, 2]);
  });

  it('preserves the prototype so class state stays class state', () => {
    class Tenant {
      constructor(public name: string) {}
      greet() {
        return `hi ${this.name}`;
      }
    }
    class AppState {
      tenants: Tenant[] = [new Tenant('alice')];
    }

    const copy = deepClone(new AppState());

    expect(copy).toBeInstanceOf(AppState);
    expect(copy.tenants[0]).toBeInstanceOf(Tenant);
    expect(copy.tenants[0]!.greet()).toBe('hi alice');
  });

  it('keeps accessors as accessors rather than flattening them', () => {
    class WithAccessor {
      first = 'ada';
      last = 'lovelace';
      get full() {
        return `${this.first} ${this.last}`;
      }
      set full(v: string) {
        [this.first, this.last] = v.split(' ') as [string, string];
      }
    }

    const copy = deepClone(new WithAccessor());
    copy.full = 'grace hopper';

    expect(copy.first).toBe('grace');
    expect(copy.full).toBe('grace hopper');
    expect(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(copy), 'full')?.get).toBeTypeOf(
      'function',
    );
  });

  it('clones Maps, Sets, Dates and RegExps', () => {
    const original = {
      map: new Map([['k', { v: 1 }]]),
      set: new Set([{ v: 2 }]),
      date: new Date(0),
      re: /abc/gi,
    };
    const copy = deepClone(original);

    original.map.get('k')!.v = 99;
    expect(copy.map.get('k')!.v).toBe(1);
    expect(copy.set.size).toBe(1);
    expect(copy.date.getTime()).toBe(0);
    expect(copy.date).not.toBe(original.date);
    expect(copy.re.source).toBe('abc');
    expect(copy.re.flags).toBe('gi');
  });

  it('handles cycles without recursing forever', () => {
    type Node = { name: string; self?: Node };
    const original: Node = { name: 'root' };
    original.self = original;

    const copy = deepClone(original);

    expect(copy.self).toBe(copy);
    expect(copy.name).toBe('root');
  });

  it('preserves shared references as shared', () => {
    const shared = { n: 1 };
    const copy = deepClone({ a: shared, b: shared });

    expect(copy.a).toBe(copy.b);
  });

  it('preserves frozen-ness', () => {
    const copy = deepClone({ frozen: Object.freeze({ a: 1 }) });

    expect(Object.isFrozen(copy.frozen)).toBe(true);
  });

  it('leaves functions referencing the same callable', () => {
    const fn = () => 'x';
    const copy = deepClone({ fn });

    expect(copy.fn).toBe(fn);
  });
});

describe('deepClone limitations', () => {
  it('LIMITATION: cannot copy #private fields', () => {
    class WithPrivate {
      #secret = 42;
      getSecret() {
        return this.#secret;
      }
    }

    // No userland clone can copy a #private field — there is no reflection for
    // them. Application state should use TypeScript `private` or a `_` prefix,
    // both of which are ordinary properties and clone correctly.
    const copy = deepClone(new WithPrivate());

    expect(() => copy.getSecret()).toThrow(/private member/);
  });

  it('clones TypeScript private and underscore-prefixed fields correctly', () => {
    class SoftPrivate {
      private secret = 42;
      _also = 7;
      getSecret() {
        return this.secret + this._also;
      }
    }

    expect(deepClone(new SoftPrivate()).getSecret()).toBe(49);
  });
});
