import { describe, it, expect, beforeEach } from 'vitest';
import { createScope, setScopeResolver } from '../../src/usecase/appScope';
import { UseCase, createUseCase } from '../../src/usecase/useCase';
import { Presenter } from '../../src/ui/Presenter';

class Cart {
  items: string[] = [];
  add(item: string) {
    this.items.push(item);
  }
}

class Person {
  first = 'Ann';
  last = 'Lee';
  get displayName() {
    return `${this.first} ${this.last}`;
  }
  set fullName(name: string) {
    const [first = '', last = ''] = name.split(' ');
    this.first = first;
    this.last = last;
  }
}

class AppState {
  person = new Person();
  form = { description: '' };
  chats = [
    { id: 'a', title: 'A', unread: 0 },
    { id: 'b', title: 'B', unread: 0 },
  ];
  byId: Record<string, number> = { a: 1 };
  labels = new Map<string, string>([['a', 'x']]);
  cart = new Cart();
  due = new Date(2020, 0, 1);
  selected?: { id: string; title: string; unread: number };
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

function watch<M extends object>(present: (state: AppState) => M) {
  const watched = { runs: 0, model: undefined as M | undefined };
  const presenter = new Presenter((state: AppState) => {
    watched.runs += 1;
    return present(state);
  });
  presenter.subscribe((model) => {
    watched.model = model;
  });
  return watched;
}

async function started() {
  await change(() => undefined);
}

describe('a presentation re-runs only when something it read changed', () => {
  it('skips a presentation whose reads were untouched', async () => {
    await started();
    const chats = watch((state) => ({ titles: state.chats.map((chat) => chat.title) }));
    const form = watch((state) => ({ description: state.form.description }));

    await change((state) => {
      state.form.description = 'leak';
    });

    expect(chats.runs).toBe(1);
    expect(form.runs).toBe(2);
    expect(form.model).toEqual({ description: 'leak' });
  });

  it('re-runs for a write inside an element it reached through an array method', async () => {
    await started();
    const chats = watch((state) => ({ titles: state.chats.map((chat) => chat.title) }));

    await change((state) => {
      state.chats[1]!.title = 'Renamed';
    });

    expect(chats.model).toEqual({ titles: ['A', 'Renamed'] });
  });

  it('re-runs when the branch it read inside is replaced', async () => {
    await started();
    const first = watch((state) => ({ title: state.chats[0]!.title }));

    await change((state) => {
      state.chats = [{ id: 'c', title: 'C', unread: 0 }];
    });

    expect(first.model).toEqual({ title: 'C' });
  });

  it('re-runs when a key is added to an object it listed', async () => {
    await started();
    const keys = watch((state) => ({ ids: Object.keys(state.byId) }));
    const has = watch((state) => ({ hasB: 'b' in state.byId }));

    await change((state) => {
      state.byId.b = 2;
    });

    expect(keys.model).toEqual({ ids: ['a', 'b'] });
    expect(has.model).toEqual({ hasB: true });
  });

  it('re-runs for any change to a map it read', async () => {
    await started();
    const label = watch((state) => ({ a: state.labels.get('a') }));

    await change((state) => {
      state.labels.set('b', 'y');
    });

    expect(label.runs).toBe(2);
  });

  it('re-runs for a method that changed what it read, and nothing else', async () => {
    await started();
    const cart = watch((state) => ({ count: state.cart.items.length }));
    const form = watch((state) => ({ description: state.form.description }));

    await change((state) => {
      state.cart.add('apple');
    });

    expect(cart.model).toEqual({ count: 1 });
    expect(form.runs).toBe(1);
  });

  it('re-runs when a value it read through a method changes', async () => {
    await started();
    const due = watch((state) => ({ hours: state.due.getHours() }));

    await change((state) => {
      state.due.setHours(9);
    });

    expect(due.model).toEqual({ hours: 9 });
  });

  it('re-runs when a field behind a getter it read changes', async () => {
    await started();
    const name = watch((state) => ({ name: state.person.displayName }));

    await change((state) => {
      state.person.first = 'Bea';
    });

    expect(name.model).toEqual({ name: 'Bea Lee' });
  });

  it('re-runs when a setter changes a field it read', async () => {
    await started();
    const first = watch((state) => ({ first: state.person.first }));

    await change((state) => {
      state.person.fullName = 'Cal Ray';
    });

    expect(first.model).toEqual({ first: 'Cal' });
  });

  it('re-runs for a change inside part of state its model handed over as it is', async () => {
    await started();
    const handed = watch((state) => ({ chat: state.chats[0] }));

    await change((state) => {
      state.chats[0]!.unread = 3;
    });

    expect(handed.model).toEqual({ chat: { id: 'a', title: 'A', unread: 3 } });
  });

  it('re-runs for a change made through a second path to the same object', async () => {
    await change((state) => {
      state.selected = state.chats[0]!;
    });
    const selected = watch((state) => ({ title: state.selected?.title }));

    await change((state) => {
      state.chats[0]!.title = 'Through the list';
    });

    expect(selected.model).toEqual({ title: 'Through the list' });
  });

  it('re-runs after a reset', async () => {
    await change((state) => {
      state.form.description = 'draft';
    });
    const form = watch((state) => ({ description: state.form.description }));

    class Reset extends Base {
      protected async runLogic() {
        this.resetAppState();
      }
    }
    await createUseCase(Reset).execute();
    await started();

    expect(form.model).toEqual({ description: '' });
  });

  it('re-runs a presentation whose last run threw', async () => {
    await started();
    let fail = true;
    const flaky = watch((state) => {
      if (fail) throw new Error('not yet');
      return { description: state.form.description };
    });
    fail = false;

    await change((state) => {
      state.cart.add('unrelated');
    });

    expect(flaky.model).toEqual({ description: '' });
  });
});
