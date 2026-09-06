import { describe, it, expect } from 'vitest';
import { deepReadonly, useCaseWritable } from './deepReadonly';
import { withMutationWindow } from './mutationWindow';

describe('deepReadonly', () => {
  it('reads through to the underlying value', () => {
    const ro = deepReadonly({ a: 1, nested: { b: 2 } });

    expect(ro.a).toBe(1);
    expect(ro.nested.b).toBe(2);
  });

  it('blocks assignment, deletion and redefinition', () => {
    const ro = deepReadonly({ a: 1 }) as { a: number };

    expect(() => {
      ro.a = 2;
    }).toThrow(/readonly/);
    expect(() => {
      delete (ro as Partial<typeof ro>).a;
    }).toThrow(/readonly/);
    expect(() => Object.defineProperty(ro, 'b', { value: 1 })).toThrow(/readonly/);
  });

  it('blocks mutation of nested objects, not just the root', () => {
    const ro = deepReadonly({ nested: { b: 2 } }) as { nested: { b: number } };

    expect(() => {
      ro.nested.b = 3;
    }).toThrow(/readonly/);
  });

  it('blocks mutating array methods but allows reads', () => {
    const ro = deepReadonly({ xs: [1, 2, 3] }).xs as unknown as number[];

    expect(ro.length).toBe(3);
    expect(ro.map((x) => x * 2)).toEqual([2, 4, 6]);
    expect(() => ro.push(4)).toThrow(/readonly Array/);
    expect(() => ro.sort()).toThrow(/readonly Array/);
  });

  it('blocks Map mutation and wraps read values', () => {
    const inner = { v: 1 };
    const map = new Map<string, typeof inner>([['k', inner]]);
    const ro = deepReadonly({ map }).map as unknown as Map<string, typeof inner>;

    expect(ro.get('k')?.v).toBe(1);
    expect(() => ro.set('x', inner)).toThrow(/readonly Map/);
    expect(() => ro.delete('k')).toThrow(/readonly Map/);
    // values read out of the map are themselves readonly
    expect(() => {
      ro.get('k')!.v = 2;
    }).toThrow(/readonly/);
  });

  it('blocks Set mutation', () => {
    const set = new Set([1, 2]);
    const ro = deepReadonly({ set }).set as unknown as Set<number>;

    expect([...ro.values()]).toEqual([1, 2]);
    expect(() => ro.add(3)).toThrow(/readonly Set/);
  });

  it('reads a built-in accessor such as size, which needs the real receiver', () => {
    const state = { set: new Set([1, 2]), map: new Map([['k', 1]]) };
    const ro = deepReadonly(state);
    const writable = useCaseWritable(state);

    expect(ro.set.size).toBe(2);
    expect(ro.map.size).toBe(1);
    expect(writable.set.size).toBe(2);
    expect(writable.map.size).toBe(1);
  });

  it('keeps a Set iterable and searchable through the proxy', () => {
    const ro = deepReadonly({ set: new Set(['a', 'b']) }).set;

    expect(ro.has('a')).toBe(true);
    expect([...ro]).toEqual(['a', 'b']);
    expect([...ro.keys()]).toEqual(['a', 'b']);
  });

  it('keeps a Map iterable and searchable through the proxy', () => {
    const ro = deepReadonly({ map: new Map([['k', 1]]) }).map;

    expect(ro.has('k')).toBe(true);
    expect([...ro.keys()]).toEqual(['k']);
    expect([...ro.entries()]).toEqual([['k', 1]]);
  });

  it('keeps a collection recognizable, which is how equality checks identify it', () => {
    const state = { set: new Set(['x']), map: new Map([['k', 1]]) };
    const ro = deepReadonly(state);
    const writable = useCaseWritable(state);

    expect(ro.set.constructor).toBe(Set);
    expect(ro.map.constructor).toBe(Map);
    expect(writable.set.constructor).toBe(Set);
    expect(ro.set).toBeInstanceOf(Set);
    expect(ro.set).toEqual(new Set(['x']));
    expect(ro.map).toEqual(new Map([['k', 1]]));
  });

  it('returns a stable proxy for the same target', () => {
    const target = { a: 1 };

    expect(deepReadonly(target)).toBe(deepReadonly(target));
  });

  it('does not re-wrap an already readonly proxy', () => {
    const once = deepReadonly({ a: 1 });

    expect(deepReadonly(once)).toBe(once);
  });

  it('leaves primitives and null untouched', () => {
    const ro = deepReadonly({ n: null, s: 'x', z: 0 });

    expect(ro.n).toBeNull();
    expect(ro.s).toBe('x');
    expect(ro.z).toBe(0);
  });

  it('hands a readonly value to a Map forEach, and refuses a write through it', () => {
    const ro = deepReadonly({ map: new Map([['k', { v: 1 }]]) }).map;
    const seen: Array<[unknown, unknown]> = [];

    ro.forEach((value, key) => seen.push([key, value.v]));

    expect(seen).toEqual([['k', 1]]);
    ro.forEach((value) => {
      expect(() => {
        (value as { v: number }).v = 2;
      }).toThrow(/readonly/);
    });
  });

  it('hands a readonly value to a Set forEach, and refuses a write through it', () => {
    const ro = deepReadonly({ set: new Set([{ v: 1 }]) }).set;
    const seen: unknown[] = [];

    ro.forEach((value) => {
      seen.push(value.v);
      expect(() => {
        (value as { v: number }).v = 2;
      }).toThrow(/readonly/);
    });

    expect(seen).toEqual([1]);
  });

  it('wraps what values() yields, not only what get() returns', () => {
    const ro = deepReadonly({ map: new Map([['k', { v: 1 }]]) }).map;

    for (const value of ro.values()) {
      expect(() => {
        (value as { v: number }).v = 2;
      }).toThrow(/readonly/);
    }
  });

  it('refuses a property written straight onto a readonly Map or Set', () => {
    const ro = deepReadonly({ map: new Map(), set: new Set() });

    expect(() => {
      (ro.map as unknown as { tag: string }).tag = 'x';
    }).toThrow(/readonly/);
    expect(() => {
      (ro.set as unknown as { tag: string }).tag = 'x';
    }).toThrow(/readonly/);
    expect(() => delete (ro.map as unknown as { tag?: string }).tag).toThrow(/readonly/);
    expect(() => delete (ro.set as unknown as { tag?: string }).tag).toThrow(/readonly/);
    expect(() => Object.defineProperty(ro.map, 'tag', { value: 'x' })).toThrow(/readonly/);
    expect(() => Object.defineProperty(ro.set, 'tag', { value: 'x' })).toThrow(/readonly/);
  });

  it('refuses a property deleted or defined on a readonly object', () => {
    const ro = deepReadonly({ a: 1 });

    expect(() => delete (ro as { a?: number }).a).toThrow(/readonly/);
    expect(() => Object.defineProperty(ro, 'b', { value: 2 })).toThrow(/readonly/);
  });

  it('lets a use case change a Map and a Set while its window is open', async () => {
    const state = { map: new Map([['k', 1]]), set: new Set(['a']) };
    const writable = useCaseWritable(state);

    await withMutationWindow(async () => {
      writable.map.set('j', 2);
      writable.map.delete('k');
      writable.set.add('b');
      writable.set.delete('a');
    });

    expect([...state.map.entries()]).toEqual([['j', 2]]);
    expect([...state.set]).toEqual(['b']);
  });

  it('lets a use case clear a Map and a Set while its window is open', async () => {
    const state = { map: new Map([['k', 1]]), set: new Set(['a']) };
    const writable = useCaseWritable(state);

    await withMutationWindow(async () => {
      writable.map.clear();
      writable.set.clear();
    });

    expect(state.map.size).toBe(0);
    expect(state.set.size).toBe(0);
  });

  it('lets a use case delete and define plain properties while its window is open', async () => {
    const state: { a?: number; b?: number; map: Map<string, number> } = { a: 1, map: new Map() };
    const writable = useCaseWritable(state);

    await withMutationWindow(async () => {
      delete writable.a;
      Object.defineProperty(writable, 'b', { value: 2, configurable: true, enumerable: true });
      (writable.map as unknown as { tag: string }).tag = 'x';
    });

    expect(state.a).toBeUndefined();
    expect(state.b).toBe(2);
    expect((state.map as unknown as { tag: string }).tag).toBe('x');
  });

  it('lets a use case delete and define properties on a Map and a Set too', async () => {
    const state = { map: new Map<string, number>(), set: new Set<string>() };
    const writable = useCaseWritable(state) as unknown as {
      map: Map<string, number> & { tag?: string };
      set: Set<string> & { tag?: string };
    };

    await withMutationWindow(async () => {
      writable.map.tag = 'x';
      writable.set.tag = 'x';
      delete writable.map.tag;
      delete writable.set.tag;
      Object.defineProperty(writable.map, 'note', { value: 1, configurable: true });
      Object.defineProperty(writable.set, 'note', { value: 1, configurable: true });
    });

    expect((state.map as { tag?: string }).tag).toBeUndefined();
    expect((state.set as { tag?: string }).tag).toBeUndefined();
    expect((state.map as unknown as { note: number }).note).toBe(1);
    expect((state.set as unknown as { note: number }).note).toBe(1);
  });

  it('does not re-wrap an already readonly Map or Set', () => {
    const once = deepReadonly({ map: new Map([['k', 1]]), set: new Set(['a']) });

    expect(deepReadonly(once.map)).toBe(once.map);
    expect(deepReadonly(once.set)).toBe(once.set);
  });
});
