import { describe, it, expect } from 'vitest';
import { deepReadonly } from './deepReadonly';

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
});
