import { describe, it, expect, beforeEach } from 'vitest';
import { createScope, setScopeResolver } from '../../src/usecase/appScope';
import { UseCase, createUseCase } from '../../src/usecase/useCase';
import { Presenter } from '../../src/ui/Presenter';

interface Row {
  id: string;
  count: number;
}

class AppState {
  rows: Row[] = [
    { id: 'a', count: 0 },
    { id: 'b', count: 0 },
  ];
  selected?: Row;
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

function watchCounts() {
  const watched = { model: undefined as { counts: number[]; selected?: number } | undefined };
  new Presenter((state: AppState) => ({
    counts: state.rows.map((row) => row.count),
    selected: state.selected?.count,
  })).subscribe((model) => {
    watched.model = model;
  });
  return watched;
}

const firstRow = (state: AppState) => state.rows[0]!;

const writesThroughArrayMethods: [string, (state: AppState) => void][] = [
  ['find', (state) => {
    state.rows.find((row) => row.id === 'a')!.count = 1;
  }],
  ['findLast', (state) => {
    state.rows.findLast((row) => row.id === 'a')!.count = 1;
  }],
  ['filter', (state) => {
    state.rows.filter((row) => row.id === 'a')[0]!.count = 1;
  }],
  ['map', (state) => {
    state.rows.map((row) => row)[0]!.count = 1;
  }],
  ['forEach', (state) => {
    state.rows.forEach((row) => {
      if (row.id === 'a') row.count = 1;
    });
  }],
  ['some', (state) => {
    state.rows.some((row) => {
      row.count = 1;
      return true;
    });
  }],
  ['reduce', (state) => {
    state.rows.reduce((total, row) => {
      if (row.id === 'a') row.count = 1;
      return total + row.count;
    }, 0);
  }],
  ['at', (state) => {
    state.rows.at(0)!.count = 1;
  }],
  ['slice', (state) => {
    state.rows.slice(0, 1)[0]!.count = 1;
  }],
  ['for...of', (state) => {
    for (const row of state.rows) {
      row.count = 1;
      break;
    }
  }],
  ['spread', (state) => {
    [...state.rows][0]!.count = 1;
  }],
  ['values()', (state) => {
    for (const row of state.rows.values()) {
      row.count = 1;
      break;
    }
  }],
  ['entries()', (state) => {
    for (const [, row] of state.rows.entries()) {
      row.count = 1;
      break;
    }
  }],
];

describe('a use case writing to an element it reached through an array method', () => {
  it.each(writesThroughArrayMethods)('reaches the presenter through %s', async (_, write) => {
    await change(() => undefined);
    const counts = watchCounts();

    await change(write);

    expect(counts.model?.counts).toEqual([1, 0]);
  });

  it('reaches a presenter that reads the element through a second path', async () => {
    await change((state) => {
      state.selected = firstRow(state);
    });
    const counts = watchCounts();

    await change((state) => {
      state.rows.find((row) => row.id === 'a')!.count = 5;
    });

    expect(counts.model).toEqual({ counts: [5, 0], selected: 5 });
  });
});
