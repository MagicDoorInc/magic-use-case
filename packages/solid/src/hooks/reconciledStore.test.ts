import { describe, it, expect } from 'vitest';
import { createReconciledStore } from './reconciledStore';

describe('createReconciledStore', () => {
  it('starts on the value it was given', () => {
    const [store] = createReconciledStore({ value: { n: 1 } });

    expect(store.value.n).toBe(1);
  });

  it('takes a replacement value', () => {
    const [store, update] = createReconciledStore<{ value: { n: number } }>({ value: { n: 1 } });

    update({ value: { n: 2 } });

    expect(store.value.n).toBe(2);
  });

  it('takes an updater, which is handed what is on screen now', () => {
    const [store, update] = createReconciledStore<{ value: { n: number } }>({ value: { n: 1 } });
    const seen: number[] = [];

    update((previous) => {
      seen.push(previous.value.n);
      return { value: { n: previous.value.n + 1 } };
    });

    expect(seen).toEqual([1]);
    expect(store.value.n).toBe(2);
  });

  it('reconciles rather than replacing, so an untouched branch keeps its identity', () => {
    const untouched = { kept: true };
    const [store, update] = createReconciledStore<{ a: { kept: boolean }; b: { n: number } }>({
      a: untouched,
      b: { n: 1 },
    });
    const before = store.a;

    update({ a: { kept: true }, b: { n: 2 } });

    expect(store.a).toBe(before);
    expect(store.b.n).toBe(2);
  });
});
