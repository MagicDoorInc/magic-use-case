import { describe, it, expect } from 'vitest';
import { deepReadonly } from '../../src/usecase/deepReadonly';
import { toRaw } from '../../src/usecase/raw';

describe('toRaw', () => {
  it('returns the object a readonly view wraps', () => {
    const state = { user: { name: 'Ada' } };

    expect(toRaw(deepReadonly(state))).toBe(state);
    expect(toRaw(deepReadonly(state).user)).toBe(state.user);
  });

  it('returns an object that is not a view as it is', () => {
    const state = { count: 1 };

    expect(toRaw(state)).toBe(state);
  });

  it('returns primitives, null and undefined as they are', () => {
    expect(toRaw(null)).toBeNull();
    expect(toRaw(undefined)).toBeUndefined();
    expect(toRaw(0)).toBe(0);
    expect(toRaw('')).toBe('');
    expect(toRaw(false)).toBe(false);
  });
});
