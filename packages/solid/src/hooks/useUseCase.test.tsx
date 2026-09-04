import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@solidjs/testing-library';
import { UseCase, createUseCase, onError } from '@magicdoor/magic-use-case-core';
import { useUseCase } from './useUseCase';

class AppState {
  count = 0;
}

class Base extends UseCase<AppState> {
  protected async initializeState() {
    return new AppState();
  }
  protected async runLogic() {}
}

class Reset extends Base {
  protected async runLogic() {
    this.resetAppState();
  }
}

class Fails extends Base {
  protected async runLogic() {
    throw new Error('boom');
  }
}

class Uploads extends Base {
  protected async runLogic() {
    this.onProgress?.(50);
    this.onProgress?.(100);
  }
}

/** Held open until the test releases it, so the loading state can be read mid-run. */
let release: () => void;
let started: Promise<void>;
class Waits extends Base {
  protected async runLogic() {
    let announceStarted: () => void;
    started = new Promise<void>((resolve) => {
      announceStarted = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    announceStarted!();
    await held;
  }
}

function Screen(props: { useCase: typeof Base }) {
  const { execute, isLoading, didSucceed, progress } = useUseCase(props.useCase);
  return (
    <>
      <button data-testid="run" onClick={() => void execute()}>
        run
      </button>
      <span data-testid="loading">{String(isLoading())}</span>
      <span data-testid="succeeded">{String(didSucceed())}</span>
      <span data-testid="progress">{String(progress())}</span>
    </>
  );
}

const read = (id: string) => screen.getByTestId(id).textContent;
const run = () => screen.getByTestId('run').click();

beforeEach(async () => {
  await createUseCase(Reset).execute();
});

afterEach(() => {
  cleanup();
});

describe('useUseCase', () => {
  it('reports success once the use case has run', async () => {
    render(() => <Screen useCase={Base} />);
    expect(read('succeeded')).toBe('false');

    run();

    await waitFor(() => expect(read('succeeded')).toBe('true'));
    expect(read('loading')).toBe('false');
  });

  it('is loading while the use case runs, and not after', async () => {
    render(() => <Screen useCase={Waits} />);

    run();

    // `isLoading` flips before the use case starts, so wait for runLogic itself
    await waitFor(() => expect(started).toBeInstanceOf(Promise));
    await started;
    expect(read('loading')).toBe('true');

    release();
    await waitFor(() => expect(read('loading')).toBe('false'));
  });

  it('reports failure without throwing at the component', async () => {
    const seen: Error[] = [];
    const stop = onError((error) => seen.push(error));

    render(() => <Screen useCase={Fails} />);
    run();

    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]!.message).toBe('boom');
    expect(read('succeeded')).toBe('false');
    stop();
  });

  it('stops loading when the use case fails, rather than waiting forever', async () => {
    const stop = onError(() => undefined);

    render(() => <Screen useCase={Fails} />);
    run();

    await waitFor(() => expect(read('loading')).toBe('false'));
    expect(read('succeeded')).toBe('false');
    stop();
  });

  it('hands progress to the screen as the use case reports it', async () => {
    render(() => <Screen useCase={Uploads} />);

    run();

    await waitFor(() => expect(read('progress')).toBe('100'));
  });
});
