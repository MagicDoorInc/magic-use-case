import { describe, it, expect, beforeEach } from 'vitest';
import { createScope, setScopeResolver } from '../../src/usecase/appScope';
import { UseCase, createUseCase } from '../../src/usecase/useCase';
import { Presenter } from '../../src/ui/Presenter';

interface Chat {
  id: string;
  title: string;
}

class AppState {
  chats: Chat[] = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
  ];
  labels = new Map<string, { text: string }>([['a', { text: 'x' }]]);
  tags = new Set<{ name: string }>([{ name: 'urgent' }]);
  due = new Date(2020, 0, 1);
  pattern = /ab+c/i;
  totals = {
    a: 1,
    get double() {
      return this.a * 2;
    },
  };
  selected?: Chat;
  lazy?: object;
}

beforeEach(() => {
  const scope = createScope();
  setScopeResolver(() => scope);
});

abstract class Base extends UseCase<AppState> {
  protected async initializeState() {
    return new AppState();
  }
}

function change(write: (state: AppState) => void) {
  class Change extends Base {
    protected async runLogic() {
      write(this.getState());
    }
  }
  return createUseCase(Change).execute();
}

function models<M extends object>(present: (state: AppState) => M) {
  const delivered: M[] = [];
  new Presenter(present).subscribe((model) => {
    if (model) delivered.push(model);
  });
  return delivered;
}

async function started() {
  await change(() => undefined);
}

describe('a model built from state is detached from it', () => {
  it('hands over a Map from state as a Map of its own', async () => {
    await started();
    const delivered = models((state) => ({ labels: state.labels }));

    await change((state) => {
      state.labels.get('a')!.text = 'y';
    });

    const [first, second] = delivered;
    expect(first!.labels).toBeInstanceOf(Map);
    expect(first!.labels.get('a')).toEqual({ text: 'x' });
    expect(second!.labels.get('a')).toEqual({ text: 'y' });
  });

  it('hands over a Set from state as a Set of its own', async () => {
    await started();
    const delivered = models((state) => ({ tags: state.tags }));

    await change((state) => {
      state.tags.add({ name: 'later' });
    });

    const [first, second] = delivered;
    expect(first!.tags).toBeInstanceOf(Set);
    expect([...first!.tags]).toEqual([{ name: 'urgent' }]);
    expect([...second!.tags]).toEqual([{ name: 'urgent' }, { name: 'later' }]);
  });

  it('hands over a date from state as a date of its own', async () => {
    await started();
    const delivered = models((state) => ({ due: state.due }));

    await change((state) => {
      state.due.setHours(9);
    });

    const [first, second] = delivered;
    expect(first!.due).toBeInstanceOf(Date);
    expect(first!.due.getHours()).toBe(0);
    expect(second!.due.getHours()).toBe(9);
  });

  it('hands over a regular expression from state that still matches', async () => {
    await started();
    const [model] = models((state) => ({ pattern: state.pattern }));

    expect(model!.pattern).toBeInstanceOf(RegExp);
    expect(model!.pattern.test('ABBC')).toBe(true);
  });

  it('keeps an accessor of a state object working against the copy', async () => {
    await started();
    const delivered = models((state) => ({ totals: state.totals }));

    await change((state) => {
      state.totals.a = 5;
    });

    const [first, second] = delivered;
    expect(first!.totals.double).toBe(2);
    expect(second!.totals.double).toBe(10);
  });

  it('keeps one state object reached by two paths as one object in the model', async () => {
    await change((state) => {
      state.selected = state.chats[0]!;
    });
    const [model] = models((state) => ({ chats: state.chats, selected: state.selected }));

    expect(model!.selected).toBe(model!.chats[0]);
  });

  it('detaches state held in a dictionary without a prototype', async () => {
    await started();
    const delivered = models((state) => {
      const byId = Object.create(null) as Record<string, Chat>;
      for (const chat of state.chats) byId[chat.id] = chat;
      return { byId };
    });

    await change((state) => {
      state.chats[0]!.title = 'Renamed';
    });

    const [first, second] = delivered;
    expect(Object.getPrototypeOf(first!.byId)).toBeNull();
    expect(first!.byId.a!.title).toBe('A');
    expect(second!.byId.a!.title).toBe('Renamed');
  });

  it('detaches state held in a frozen model without writing into it', async () => {
    await started();
    const built: object[] = [];
    const delivered = models((state) => {
      const rest = Object.freeze([state.chats[1]!]);
      const model = Object.freeze({ chat: state.chats[0]!, rest });
      built.push(model, rest);
      return model;
    });

    await change((state) => {
      state.chats[0]!.title = 'Renamed';
      state.chats[1]!.title = 'Moved';
    });

    const [first, second] = delivered;
    expect(first).not.toBe(built[0]);
    expect(first!.rest).not.toBe(built[1]);
    expect(Array.isArray(first!.rest)).toBe(true);
    expect(first!.chat.title).toBe('A');
    expect(first!.rest[0]!.title).toBe('B');
    expect(second!.chat.title).toBe('Renamed');
    expect(second!.rest[0]!.title).toBe('Moved');
  });

  it('follows a model that refers back to itself without looping', async () => {
    await started();
    const delivered = models((state) => {
      const node: { chat: Chat; self?: unknown } = { chat: state.chats[0]! };
      node.self = node;
      return node;
    });

    await change((state) => {
      state.chats[0]!.title = 'Renamed';
    });

    const [first] = delivered;
    expect(first!.self).toBe(first);
    expect(first!.chat.title).toBe('A');
  });

  it('hands over an instance the presentation built itself as it is', async () => {
    await started();
    class Summary {
      constructor(readonly count: number) {}
    }
    const built: Summary[] = [];
    const [model] = models((state) => {
      const summary = new Summary(state.chats.length);
      built.push(summary);
      return { summary };
    });

    expect(model!.summary).toBe(built[0]);
    expect(model!.summary.count).toBe(2);
  });

  it('skips a key a proxy in state claims but cannot describe', async () => {
    await change((state) => {
      state.lazy = new Proxy(
        { real: 1 },
        {
          ownKeys: (target) => [...Reflect.ownKeys(target), 'phantom'],
          getOwnPropertyDescriptor: (target, key) =>
            key === 'phantom' ? undefined : Reflect.getOwnPropertyDescriptor(target, key),
        },
      );
    });
    const [model] = models((state) => ({ lazy: state.lazy }));

    expect(model!.lazy).toEqual({ real: 1 });
    expect(Reflect.ownKeys(model!.lazy!)).toEqual(['real']);
  });
});
