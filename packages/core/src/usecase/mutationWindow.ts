/**
 * Application state may only be mutated from inside a running use case.
 *
 * `UseCase.runWithUpdate` opens a window for the duration of `runLogic`, and the
 * proxy returned by `getState()` refuses writes outside it. This turns a silent
 * desync — state changed with no state-change event emitted, so the UI never
 * updates — into an immediate error at the offending line.
 *
 * A counter rather than a boolean, so nested or concurrent use cases do not
 * close the window early.
 */
let openWindows = 0;

export function openMutationWindow(): void {
  openWindows += 1;
}

export function closeMutationWindow(): void {
  openWindows = Math.max(0, openWindows - 1);
}

export function isMutationWindowOpen(): boolean {
  return openWindows > 0;
}

export async function withMutationWindow<T>(run: () => Promise<T>): Promise<T> {
  openMutationWindow();
  try {
    return await run();
  } finally {
    closeMutationWindow();
  }
}
