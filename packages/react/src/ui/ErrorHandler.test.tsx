/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { UseCase, createUseCase, onError } from '@magicdoor/magic-use-case-core';
import { ErrorHandler } from './ErrorHandler';

class AppState {}

class Fails extends UseCase<AppState> {
  protected async initializeState() {
    return new AppState();
  }
  protected async runLogic(message: unknown) {
    throw new Error(message as string);
  }
}

/** `execute` reports and rethrows; only `useUseCase` swallows, and this is not that. */
const fail = (message: string) => createUseCase(Fails).execute(message).catch(() => undefined);

const Dialog = ({ error, onClose }: { error: Error; onClose: () => void }) => (
  <button data-testid="dialog" onClick={onClose}>
    {error.message}
  </button>
);

const dialog = () => screen.queryByTestId('dialog');

afterEach(() => {
  cleanup();
});

describe('ErrorHandler', () => {
  it('shows the dialog for a failure the screen chooses to report', async () => {
    render(
      <ErrorHandler onWillReportError={() => true} renderErrorDialog={Dialog}>
        <span />
      </ErrorHandler>
    );

    await fail('the server said no');

    await waitFor(() => expect(dialog()?.textContent).toBe('the server said no'));
  });

  it('shows nothing for a failure the screen handles itself', async () => {
    const seen: Error[] = [];
    render(
      <ErrorHandler
        onWillReportError={(error) => {
          seen.push(error);
          return false;
        }}
        renderErrorDialog={Dialog}>
        <span />
      </ErrorHandler>
    );

    await fail('sign in again');

    expect(seen.map((error) => error.message)).toEqual(['sign in again']);
    expect(dialog()).toBeNull();
  });

  it('tells the screen once the failure has been shown', async () => {
    const shown: Error[] = [];
    render(
      <ErrorHandler onWillReportError={() => true} onDidReportError={(error) => shown.push(error)} renderErrorDialog={Dialog}>
        <span />
      </ErrorHandler>
    );

    await fail('boom');

    await waitFor(() => expect(shown.map((error) => error.message)).toEqual(['boom']));
  });

  it('takes the dialog away when it is closed', async () => {
    render(
      <ErrorHandler onWillReportError={() => true} renderErrorDialog={Dialog}>
        <span />
      </ErrorHandler>
    );

    await fail('boom');
    await waitFor(() => expect(dialog()).not.toBeNull());

    dialog()!.click();

    await waitFor(() => expect(dialog()).toBeNull());
  });

  it('catches a child that throws while rendering, and reports it too', async () => {
    const seen: Error[] = [];
    const Exploding = () => {
      throw new Error('render exploded');
    };
    // React logs the caught render error; the boundary is what this asserts.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorHandler
        onWillReportError={(error) => {
          seen.push(error);
          return true;
        }}
        renderErrorDialog={Dialog}>
        <Exploding />
      </ErrorHandler>
    );

    await waitFor(() => expect(dialog()?.textContent).toBe('render exploded'));
    expect(seen.map((error) => error.message)).toContain('render exploded');
    quiet.mockRestore();
  });

  it('stops listening once it is gone', async () => {
    const seen: Error[] = [];
    // outlives the component, so what it stops hearing is its own doing
    const stillListening = onError(() => undefined);
    render(
      <ErrorHandler
        onWillReportError={(error) => {
          seen.push(error);
          return false;
        }}
        renderErrorDialog={Dialog}>
        <span />
      </ErrorHandler>
    );

    await fail('first');
    cleanup();
    await fail('second');

    expect(seen.map((error) => error.message)).toEqual(['first']);
    stillListening();
  });
});
