import { currentScope, type AppScope } from './appScope';

/**
 * Application state may only be mutated from inside a running use case.
 *
 * `UseCase.runWithUpdate` opens a window for the duration of `runLogic`, and the
 * proxy returned by `getState()` refuses writes outside it. This turns a silent
 * desync — state changed with no state-change event emitted, so the UI never
 * updates — into an immediate error at the offending line.
 *
 * A counter rather than a boolean, so nested or concurrent use cases do not
 * close the window early. It belongs to the scope rather than to the module:
 * one request's running use case must not make another request's state
 * writable.
 *
 * The scope is captured when the window opens and closed on that same scope. A
 * run can outlive the scope it started in — a detached one, or one still in
 * flight when a request ends — and resolving the scope again at closing time
 * would decrement whichever scope is current by then, shutting a window that
 * another run is depending on, or throwing where no scope resolves at all.
 */
export function openMutationWindow(): AppScope {
  const scope = currentScope();
  scope.openMutationWindows += 1;
  return scope;
}

export function closeMutationWindow(scope: AppScope): void {
  scope.openMutationWindows = Math.max(0, scope.openMutationWindows - 1);
}

export function isMutationWindowOpen(): boolean {
  return currentScope().openMutationWindows > 0;
}

export async function withMutationWindow<T>(run: () => Promise<T>): Promise<T> {
  const scope = openMutationWindow();
  try {
    return await run();
  } finally {
    closeMutationWindow(scope);
  }
}

export function assertMutationWindowOpen(operation: string): void {
  if (isMutationWindowOpen()) return;

  throw new Error(
    `[magic-use-case] ${operation} is only allowed inside a running use case.`,
  );
}
