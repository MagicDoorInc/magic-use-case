import { currentScope } from './appScope';

/**
 * Whether a run has a caller waiting on it.
 *
 * A run that does announces nothing itself: its caller decides what the failure
 * means and what the screen is eventually told, and the outermost run announces
 * everything written beneath it at once. A detached run has no caller, so it
 * neither stays quiet for one nor silences the run that started it.
 *
 * This is deliberately not the mutation window. That answers whether state may
 * be written, which a detached run may; this answers whether someone is waiting,
 * which for a detached run nobody is.
 */
export function enterAttachedRun(): void {
  currentScope().attachedRuns += 1;
}

export function leaveAttachedRun(): void {
  const scope = currentScope();
  scope.attachedRuns = Math.max(0, scope.attachedRuns - 1);
}

export function isCallerStillRunning(): boolean {
  return currentScope().attachedRuns > 0;
}

export async function withAttachedRun<T>(run: () => Promise<T>): Promise<T> {
  enterAttachedRun();
  try {
    return await run();
  } finally {
    leaveAttachedRun();
  }
}
