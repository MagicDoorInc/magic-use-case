import { describe, it, expect } from 'vitest';
import { deepReadonly, toRaw, useCaseWritable } from '../../src/usecase/deepReadonly';
import { withMutationWindow } from '../../src/usecase/mutationWindow';

interface Row {
  id: string;
}

function rowsState() {
  return {
    rows: [{ id: 'a' }, { id: 'b' }] as Row[],
    selected: undefined as unknown,
    picked: [] as unknown[],
    byRow: new Map<unknown, unknown>(),
    rowSet: new Set<unknown>(),
  };
}

const isView = (value: unknown) => toRaw(value) !== value;

describe('searching an array for an element read from state', () => {
  it('finds it with indexOf, lastIndexOf and includes in a use case', () => {
    const writable = useCaseWritable(rowsState());
    const second = writable.rows[1]!;

    expect(writable.rows.indexOf(second)).toBe(1);
    expect(writable.rows.lastIndexOf(second)).toBe(1);
    expect(writable.rows.includes(second)).toBe(true);
  });

  it('finds it with a raw element or a readonly one', () => {
    const state = rowsState();
    const readonly = deepReadonly(state);

    expect(readonly.rows.indexOf(state.rows[1]!)).toBe(1);
    expect(readonly.rows.indexOf(readonly.rows[1]!)).toBe(1);
    expect(readonly.rows.includes({ id: 'b' })).toBe(false);
  });

  it('passes the start position through', () => {
    const writable = useCaseWritable(rowsState());

    expect(writable.rows.indexOf(writable.rows[0]!, 1)).toBe(-1);
  });
});

describe('storing a value read from state', () => {
  it('stores the element itself when assigned', async () => {
    const state = rowsState();
    const writable = useCaseWritable(state);

    await withMutationWindow(async () => {
      writable.selected = writable.rows[0];
    });

    expect(state.selected).toBe(state.rows[0]);
  });

  it('stores the element itself when defined', async () => {
    const state = rowsState();
    const writable = useCaseWritable(state);

    await withMutationWindow(async () => {
      Object.defineProperty(writable, 'selected', { value: writable.rows[0], writable: true, configurable: true, enumerable: true });
      Object.defineProperty(writable, 'computed', { get: () => 1, configurable: true });
    });

    expect(state.selected).toBe(state.rows[0]);
    expect((state as unknown as { computed: number }).computed).toBe(1);
  });

  it('stores the elements themselves when pushed, spliced or filled', async () => {
    const state = rowsState();
    const writable = useCaseWritable(state);

    await withMutationWindow(async () => {
      writable.picked.push(writable.rows[0]);
      writable.picked.splice(0, 0, writable.rows[1]);
      writable.picked.fill(writable.rows[0], 1);
    });

    expect(state.picked).toEqual([state.rows[1], state.rows[0]]);
    expect(state.picked.every((item) => !isView(item))).toBe(true);
  });

  it('stores keys and values themselves in a Map and a Set', async () => {
    const state = rowsState();
    const writable = useCaseWritable(state);

    await withMutationWindow(async () => {
      writable.byRow.set(writable.rows[0], writable.rows[1]);
      writable.rowSet.add(writable.rows[0]);
    });

    expect([...state.byRow.entries()]).toEqual([[state.rows[0], state.rows[1]]]);
    expect(isView([...state.byRow.keys()][0])).toBe(false);
    expect(isView([...state.rowSet][0])).toBe(false);
  });

  it('stores the elements themselves inside a new array, object, Map or Set', async () => {
    const state = rowsState();
    const writable = useCaseWritable(state);

    await withMutationWindow(async () => {
      writable.picked = [...writable.rows];
      writable.selected = { row: writable.rows[0], nested: [{ row: writable.rows[1] }] };
      writable.byRow = new Map([[writable.rows[0], { row: writable.rows[1] }]]);
      writable.rowSet = new Set([writable.rows[0], 'plain']);
    });

    expect(state.picked[0]).toBe(state.rows[0]);
    const selected = state.selected as { row: Row; nested: { row: Row }[] };
    expect(selected.row).toBe(state.rows[0]);
    expect(selected.nested[0]!.row).toBe(state.rows[1]);
    const [[key, value]] = [...state.byRow.entries()] as [[Row, { row: Row }]];
    expect(key).toBe(state.rows[0]);
    expect(value.row).toBe(state.rows[1]);
    expect([...state.rowSet]).toEqual([state.rows[0], 'plain']);
  });

  it('leaves a new container holding nothing from state as it is', async () => {
    const state = rowsState();
    const writable = useCaseWritable(state);
    const fresh = { list: [{ id: 'c' }], map: new Map([['k', { v: 1 }]]), set: new Set([{ v: 2 }]) };

    await withMutationWindow(async () => {
      writable.selected = fresh;
    });

    expect(state.selected).toBe(fresh);
    expect((state.selected as typeof fresh).map).toBe(fresh.map);
  });

  it('changes a container in place when it can, keeping it sealed or closed', async () => {
    const state = rowsState();
    const writable = useCaseWritable(state);
    const sealed = Object.seal({ row: undefined as unknown });
    const closed = Object.preventExtensions({ row: undefined as unknown });
    const nullPrototype = Object.create(null) as { row?: unknown };

    await withMutationWindow(async () => {
      sealed.row = writable.rows[0];
      closed.row = writable.rows[0];
      nullPrototype.row = writable.rows[1];
      writable.selected = { sealed, closed, nullPrototype };
    });

    const selected = state.selected as Record<'sealed' | 'closed' | 'nullPrototype', { row: Row }>;
    expect(selected.sealed).toBe(sealed);
    expect(sealed.row).toBe(state.rows[0]);
    expect(Object.isSealed(sealed)).toBe(true);
    expect(selected.closed).toBe(closed);
    expect(closed.row).toBe(state.rows[0]);
    expect(selected.nullPrototype).toBe(nullPrototype);
    expect(nullPrototype.row).toBe(state.rows[1]);
  });

  it('copies a container whose slot is read-only, keeping it frozen, sealed or closed', async () => {
    const state = rowsState();
    const writable = useCaseWritable(state);
    const readOnlySlot = (row: unknown) =>
      Object.defineProperty({ label: 'x' }, 'row', { value: row, enumerable: true, configurable: true });

    await withMutationWindow(async () => {
      writable.picked = Object.freeze([writable.rows[0]]) as unknown[];
      writable.selected = {
        sealed: Object.seal(readOnlySlot(writable.rows[0])),
        closed: Object.preventExtensions(readOnlySlot(writable.rows[0])),
        open: readOnlySlot(writable.rows[0]),
      };
    });

    expect(Object.isFrozen(state.picked)).toBe(true);
    expect(state.picked[0]).toBe(state.rows[0]);
    const selected = state.selected as Record<'sealed' | 'closed' | 'open', { row: Row }>;
    expect(selected.sealed.row).toBe(state.rows[0]);
    expect(Object.isSealed(selected.sealed)).toBe(true);
    expect(Object.isFrozen(selected.sealed)).toBe(false);
    expect(selected.closed.row).toBe(state.rows[0]);
    expect(Object.isExtensible(selected.closed)).toBe(false);
    expect(Object.isSealed(selected.closed)).toBe(false);
    expect(selected.open.row).toBe(state.rows[0]);
    expect(Object.isExtensible(selected.open)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(selected.open, 'row')!.writable).toBe(false);
  });

  it('keeps a frozen object frozen when it copies it', async () => {
    const state = rowsState();
    const writable = useCaseWritable(state);

    await withMutationWindow(async () => {
      writable.selected = Object.freeze({ row: writable.rows[0], label: 'x' });
    });

    expect(Object.isFrozen(state.selected)).toBe(true);
    expect((state.selected as { row: Row }).row).toBe(state.rows[0]);
  });

  it('skips accessors and handles a container that refers to itself', async () => {
    const state = rowsState();
    const writable = useCaseWritable(state);
    const looped: { self?: unknown; row?: Row; readonly computed: number } = {
      get computed() {
        return 1;
      },
    };
    looped.self = looped;

    await withMutationWindow(async () => {
      looped.row = writable.rows[0];
      writable.selected = looped;
    });

    expect(state.selected).toBe(looped);
    expect(looped.row).toBe(state.rows[0]);
    expect(looped.self).toBe(looped);
  });

  it('leaves a class instance as it is', async () => {
    class Holder {
      constructor(public row: Row) {}
    }
    const state = rowsState();
    const writable = useCaseWritable(state);

    await withMutationWindow(async () => {
      writable.selected = new Holder(writable.rows[0]!);
    });

    expect(state.selected).toBeInstanceOf(Holder);
  });
});

describe('reading a Map or Set keyed by objects from state', () => {
  it('finds a key read from state with get and has', () => {
    const key = { id: 'k' };
    const writable = useCaseWritable({ keys: [key], map: new Map([[key, { v: 1 }]]), set: new Set([key]) });

    expect(writable.map.get(writable.keys[0]!)).toEqual({ v: 1 });
    expect(writable.map.has(writable.keys[0]!)).toBe(true);
    expect(writable.set.has(writable.keys[0]!)).toBe(true);
    expect(writable.set.has('missing' as unknown as typeof key)).toBe(false);
  });

  it('hands out keys as views through keys(), entries() and forEach', () => {
    const key = { id: 'k' };
    const readonly = deepReadonly({ map: new Map([[key, 1]]), set: new Set([key]) });

    const [fromKeys] = [...readonly.map.keys()];
    const [fromEntries] = [...readonly.map.entries()][0]!;
    let fromForEach: unknown;
    readonly.map.forEach((_, k) => {
      fromForEach = k;
    });

    expect(isView(fromKeys)).toBe(true);
    expect(fromEntries).toBe(fromKeys);
    expect(fromForEach).toBe(fromKeys);
  });

  it('pairs each Set value with itself in entries() and yields views from keys()', () => {
    const value = { id: 'v' };
    const readonly = deepReadonly({ set: new Set([value]) });

    const [first, second] = [...readonly.set.entries()][0]!;
    const [fromKeys] = [...readonly.set.keys()];

    expect(first).toBe(second);
    expect(isView(first)).toBe(true);
    expect(fromKeys).toBe(first);
  });

  it('wraps what other Set and Map methods return and accepts a Set read from state', () => {
    const value = { id: 'v' };
    const readonly = deepReadonly({ left: new Set([value]), right: new Set([value]), map: new Map([['k', value]]) });

    const union = readonly.left.union(readonly.right);
    const [fromUnion] = [...union];

    expect(isView(union)).toBe(true);
    expect(toRaw(fromUnion)).toBe(value);
    expect(readonly.left.isSubsetOf(readonly.right)).toBe(true);
    expect(readonly.map.toString()).toBe('[object Map]');
  });
});
