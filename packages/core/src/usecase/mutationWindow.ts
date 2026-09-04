import { currentScope } from './appScope';

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
 */
export function openMutationWindow(): void {
  currentScope().openMutationWindows += 1;
}

export function closeMutationWindow(): void {
  const scope = currentScope();
  scope.openMutationWindows = Math.max(0, scope.openMutationWindows - 1);
}

export function isMutationWindowOpen(): boolean {
  return currentScope().openMutationWindows > 0;
}

export async function withMutationWindow<T>(run: () => Promise<T>): Promise<T> {
  openMutationWindow();
  try {
    return await run();
  } finally {
    closeMutationWindow();
  }
}

export function assertMutationWindowOpen(operation: string): void {
  if (isMutationWindowOpen()) return;

  throw new Error(
    `[magic-use-case] ${operation} is only allowed inside a running use case.`,
  );
}
