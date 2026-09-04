import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSignal, type Accessor } from 'solid-js';
import { render, screen, cleanup } from '@solidjs/testing-library';
import { UseCase, createUseCase } from '@magicdoor/magic-use-case-core';
import { usePresenter } from './usePresenter';

class AppState {
  count = 0;
}

class Bump extends UseCase<AppState> {
  protected async initializeState() {
    return new AppState();
  }
  protected async runLogic() {
    this.getState().count += 1;
  }
}

class Reset extends Bump {
  protected async runLogic() {
    this.resetAppState();
  }
}

const bump = () => createUseCase(Bump).execute();
const reset = () => createUseCase(Reset).execute();

const presentCount = (state: AppState) => ({ n: state.count });

function Counter(props: { present?: (state: AppState) => { n: number }; label?: string }) {
  // Read once, like the hook itself: a component keeps the presentation it started with.
  const { model } = usePresenter(props.present ?? presentCount);
  return <span data-testid={props.label ?? 'count'}>{model() ? model()!.n : 'empty'}</span>;
}

beforeEach(async () => {
  // Application state is module-global; clear it so each test bootstraps its own.
  await reset();
});

afterEach(() => {
  cleanup();
});

describe('usePresenter', () => {
  it('hands the component a model it cannot write, before and after a change', async () => {
    const attempts: string[] = [];

    function Mutator() {
      const { model } = usePresenter((state: AppState) => ({ n: state.count, tags: ['a'] }));
      const rendered = () => {
        const current = model();
        if (!current) return 'empty';
        for (const [name, write] of [
          ['assign', () => ((current as { n: number }).n = 99)],
          ['push', () => (current.tags as string[]).push('b')],
        ] as Array<[string, () => unknown]>) {
          try {
            write();
            attempts.push(`${name}:ALLOWED`);
          } catch {
            attempts.push(`${name}:blocked`);
          }
        }
        return String(current.n);
      };
      return <span data-testid="count">{rendered()}</span>;
    }

    render(() => <Mutator />);
    await bump();
    await bump();

    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts.every((attempt) => attempt.endsWith(':blocked'))).toBe(true);
  });

  it('renders the model built from state that already exists', async () => {
    await bump();

    render(() => <Counter />);

    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('renders empty until a use case has produced state', () => {
    render(() => <Counter />);

    expect(screen.getByTestId('count').textContent).toBe('empty');
  });

  it('rerenders when a use case changes state', async () => {
    render(() => <Counter />);

    await bump();
    expect(screen.getByTestId('count').textContent).toBe('1');

    await bump();
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('stops running the presentation once the component is disposed', async () => {
    const present = vi.fn(presentCount);
    const { unmount } = render(() => <Counter present={present} />);
    await bump();
    const runsWhileMounted = present.mock.calls.length;

    unmount();
    await bump();

    expect(present).toHaveBeenCalledTimes(runsWhileMounted);
  });

  it('keeps the presentation it was first given, ignoring later ones', async () => {
    const first = vi.fn(presentCount);
    const second = vi.fn((state: AppState) => ({ n: state.count * 100 }));

    function Swapper() {
      const [present, setPresent] = createSignal<(state: AppState) => { n: number }>(first);
      return (
        <>
          <Counter present={present()} />
          <button onClick={() => setPresent(() => second)}>swap</button>
        </>
      );
    }

    render(() => <Swapper />);
    await bump();
    (screen.getByText('swap') as HTMLButtonElement).click();
    await bump();

    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(second).not.toHaveBeenCalled();
  });

  it('runs one shared presentation once for every component using it', async () => {
    const present = vi.fn(presentCount);

    render(() => (
      <>
        <Counter present={present} label="first" />
        <Counter present={present} label="second" />
      </>
    ));
    present.mockClear();

    await bump();

    expect(screen.getByTestId('first').textContent).toBe('1');
    expect(screen.getByTestId('second').textContent).toBe('1');
    // Two components, two presenters — but one presentation, so one run.
    expect(present).toHaveBeenCalledTimes(1);
  });

  it('clears the model when application state is reset', async () => {
    await bump();
    render(() => <Counter />);
    expect(screen.getByTestId('count').textContent).toBe('1');

    await reset();

    expect(screen.getByTestId('count').textContent).toBe('empty');
  });

  it('exposes the model as an accessor, so reading it tracks', async () => {
    let model: Accessor<{ n: number } | undefined> | undefined;
    render(() => {
      model = usePresenter(presentCount).model;
      return <span data-testid="count">{model()?.n ?? 'empty'}</span>;
    });

    await bump();

    expect(model!()).toEqual({ n: 1 });
  });
});
