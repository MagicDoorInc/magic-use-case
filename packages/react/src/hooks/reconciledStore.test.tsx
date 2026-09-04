/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useReconciledStore } from './reconciledStore';

/**
 * The point of reconciling is identity: React rerenders what changed reference,
 * so a branch nobody touched must come back as the very same object.
 */
function store<T>(initial: T) {
  const rendered = renderHook(() => useReconciledStore<T>(initial));
  return {
    read: () => rendered.result.current[0],
    write: (next: T | ((prev: T | undefined) => T)) => act(() => rendered.result.current[1](next)),
  };
}

class Tenant {
  constructor(public name: string) {}
}

afterEach(() => {
  cleanup();
});

describe('useReconciledStore', () => {
  it('starts on the value it was given', () => {
    const { read } = store({ n: 1 });

    expect(read()).toEqual({ n: 1 });
  });

  it('keeps the very same object when nothing changed', () => {
    const { read, write } = store({ n: 1, nested: { deep: true } });
    const before = read();

    write({ n: 1, nested: { deep: true } });

    expect(read()).toBe(before);
  });

  it('takes an updater, which is handed what is on screen now', () => {
    const { read, write } = store({ n: 1 });

    write((previous) => ({ n: previous!.n + 1 }));

    expect(read()).toEqual({ n: 2 });
  });

  it('replaces outright when there was nothing on screen before', () => {
    const { read, write } = store<{ n: number } | undefined>(undefined);

    write({ n: 1 } as never);

    expect(read()).toEqual({ n: 1 });
  });

  it('keeps an untouched sibling while replacing the branch that changed', () => {
    const { read, write } = store({ kept: { a: 1 }, changed: { b: 1 } });
    const before = read()!;

    write({ kept: { a: 1 }, changed: { b: 2 } });

    expect(read()!.kept).toBe(before.kept);
    expect(read()!.changed).not.toBe(before.changed);
  });

  it('keeps untouched array items, and only the changed one is new', () => {
    const { read, write } = store({ rows: [{ id: 1 }, { id: 2 }] });
    const before = read()!.rows;

    write({ rows: [{ id: 1 }, { id: 99 }] });

    expect(read()!.rows[0]).toBe(before[0]);
    expect(read()!.rows[1]).not.toBe(before[1]);
  });

  it('keeps untouched Map values, and notices a Map that grew', () => {
    const { read, write } = store({ byId: new Map([['a', { n: 1 }]]) });
    const before = read()!.byId;

    write({ byId: new Map([['a', { n: 1 }]]) });
    expect(read()!.byId).toBe(before);

    write({ byId: new Map([['a', { n: 1 }], ['b', { n: 2 }]]) });
    expect(read()!.byId).not.toBe(before);
    expect(read()!.byId.get('a')).toBe(before.get('a'));
  });

  it('keeps untouched Set members, and notices a Set that grew', () => {
    const { read, write } = store({ tags: new Set([{ id: 1 }]) });
    const before = read()!.tags;
    const firstMember = [...before][0];

    write({ tags: new Set([{ id: 1 }]) });
    expect(read()!.tags).toBe(before);

    write({ tags: new Set([{ id: 1 }, { id: 2 }]) });
    expect(read()!.tags).not.toBe(before);
    expect([...read()!.tags]).toContain(firstMember);
  });

  it('compares dates by the instant they name, not by identity', () => {
    const { read, write } = store({ at: new Date('2026-01-01') });
    const before = read();

    write({ at: new Date('2026-01-01') });
    expect(read()).toBe(before);

    write({ at: new Date('2026-01-02') });
    expect(read()).not.toBe(before);
  });

  it('treats a class instance and a lookalike object as different', () => {
    const { read, write } = store<{ tenant: Tenant }>({ tenant: new Tenant('ada') });
    const before = read();

    write({ tenant: { name: 'ada' } as Tenant });

    expect(read()).not.toBe(before);
  });

  it('notices a key that was added or removed', () => {
    const { read, write } = store<Record<string, number>>({ a: 1 });
    const before = read();

    write({ a: 1, b: 2 });
    expect(read()).not.toBe(before);

    write({ a: 1 });
    expect(read()).toEqual({ a: 1 });
  });

  it('notices a value replaced by null, and null by a value', () => {
    const { read, write } = store<{ v: unknown }>({ v: { n: 1 } });
    const before = read();

    write({ v: null });
    expect(read()).not.toBe(before);

    const withNull = read();
    write({ v: null });
    expect(read()).toBe(withNull);

    write({ v: { n: 1 } });
    expect(read()).not.toBe(withNull);
  });

  it('keeps a primitive array untouched when it did not change', () => {
    const { read, write } = store({ names: ['ada', 'grace'] });
    const before = read();

    write({ names: ['ada', 'grace'] });

    expect(read()).toBe(before);
  });

  it('hands back the incoming Map when every value matched but the keys moved', () => {
    const before = new Map<string, undefined>([['a', undefined]]);
    const after = new Map<string, undefined>([['b', undefined]]);
    const { read, write } = store(before);

    write(after);

    // The keys differ, so it is not the same map; every value matched, so there
    // was nothing to rebuild and the incoming one is used as it stands.
    expect(read()).toBe(after);
  });

  it('hands back the incoming Set when nothing in it matched the old one', () => {
    const before = new Set([{ id: 1 }]);
    const after = new Set([{ id: 2 }]);
    const { read, write } = store(before);

    write(after);

    expect(read()).toBe(after);
  });
});
