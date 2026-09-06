/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { UseCase, createUseCase } from '@magicdoor/magic-use-case-core';
import { usePresenter } from './index';

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

function Counter() {
  const { model } = usePresenter((state: AppState) => ({ n: state.count }));
  return <span data-testid="count">{model ? model.n : 'empty'}</span>;
}

afterEach(cleanup);

/**
 * The entry declares its own `usePresenter` so an application's module
 * augmentation can pin the state type. That indirection is what these cover.
 */
describe('the package entry', () => {
  it('exposes a presenter hook the application reads its own state through', async () => {
    render(<Counter />);
    await act(async () => void (await createUseCase(Bump).execute()));

    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
