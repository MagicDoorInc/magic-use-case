import { deepReadonly, useCaseWritable } from './deepReadonly';
import { currentScope } from './appScope';
import { type EventEmitter } from './eventEmitter';
import { withMutationWindow, assertMutationWindowOpen } from './mutationWindow';
import { withAttachedRun, isCallerStillRunning } from './attachment';
import { deepClone } from './deepClone';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UseCaseClass<T> = new (...args: any[]) => UseCase<T>;

interface RunKind {
  /** Started by a use case that is not waiting for it, so it belongs to nobody. */
  detached: boolean;
  /** Somebody up the stack receives the exception and decides what it means. */
  hasCaller: boolean;
}

/**
 * Runs nobody is waiting on. Their failures reach no caller, so they are the
 * ones that report. A use case constructed any other way is assumed to have a
 * caller who will handle its exception.
 */
const entryPoints = new WeakSet<UseCase<unknown>>();

export function createUseCase<T>(
  UseCaseClass: UseCaseClass<T>,
  onProgress?: (value: number) => void
): UseCase<T> {
  const useCase = new (UseCaseClass as new (onProgress?: (value: number) => void) => UseCase<T>)(onProgress);
  entryPoints.add(useCase as UseCase<unknown>);
  return useCase;
}

export abstract class UseCase<T> {
  protected onProgress?: (progress: number) => void;

  constructor(onProgress?: (progress: number) => void) {
    this.onProgress = onProgress;
  }

  /** Resolved per emit, so an execution always announces on the scope it is running in. */
  private get eventEmitter(): EventEmitter {
    return currentScope().emitter;
  }

  public execute(params?: unknown): Promise<void> {
    return this.run(params, { detached: false, hasCaller: !entryPoints.has(this as UseCase<unknown>) });
  }

  /**
   * Starts a use case that this one does not wait for. It runs on its own: the
   * caller returns and announces its own changes immediately, and the detached
   * run announces its own when it lands. Nobody is waiting on it, so its failure
   * is reported rather than thrown.
   */
  protected detach(UseCaseClass: UseCaseClass<T>, params?: unknown): void {
    // Reported on its way out, so there is nothing left for a rejection to tell
    // anyone — and nobody is holding the promise to hear it.
    void createUseCase(UseCaseClass)
      .run(params, { detached: true, hasCaller: false })
      .catch(() => undefined);
  }

  private async run(params: unknown, run: RunKind): Promise<void> {
    // Captured once: everything this execution touches belongs to the scope it
    // started in, however many times it awaits.
    const scope = currentScope();
    // Bootstrap exactly once. Core owns this decision: a subclass cannot
    // force a re-initialization and silently replace live state. Clearing
    // state is what `resetAppState()` is for.
    if (scope.state === undefined) {
      if (!scope.initialStatePromise) {
        scope.initialStatePromise = this.initializeState().then((state) => {
          // Adopted, not borrowed: the caller keeps their object, but it is
          // no longer application state and writing to it has no effect.
          scope.state = deepClone(state);
        });
      }
      try {
        await scope.initialStatePromise;
      } catch (error) {
        this.reportUnlessCallerWill(error, run);
        throw error;
      } finally {
        scope.initialStatePromise = undefined;
      }
    }
    // Keyed by constructor identity, so `object` is sufficient and avoids the
    // unsafe `Function` type.
    const classMap = scope.runningUseCases.get(this.constructor) ?? new Map<string, Promise<void>>();
    scope.runningUseCases.set(this.constructor, classMap);
    const paramsKey = JSON.stringify(params);
    if (classMap.has(paramsKey)) {
      await classMap.get(paramsKey);
      return;
    }
    const executionPromise = this.runWithUpdate(() => this.runLogic(params), run);
    classMap.set(paramsKey, executionPromise);
    try {
      await executionPromise;
    } finally {
      classMap.delete(paramsKey);
      if (classMap.size === 0) {
        scope.runningUseCases.delete(this.constructor);
      }
    }
  }

  protected getState(): T {
    return useCaseWritable(currentScope().state as object) as T;
  }

  /**
   * Clears application state so the next execution bootstraps it again.
   *
   * All four pieces of module state go together: the state itself, the
   * emitter's retained copy, the in-flight dedup map, and any bootstrap in
   * flight. Leaving any one behind resurrects the old state.
   */
  protected resetAppState(): void {
    assertMutationWindowOpen('Resetting application state');

    const scope = currentScope();
    scope.state = undefined;
    scope.runningUseCases.clear();
    scope.initialStatePromise = undefined;
    this.eventEmitter.resetState();
  }

  protected navigate(url: string) {
    this.eventEmitter.emitNavigation(url);
  }

  /**
   * Announces a failure the screen should hear about, for a use case that
   * handles the failure rather than rethrowing it. Anything rethrown is
   * reported on its way out and must not be reported here as well.
   */
  protected report(error: Error) {
    this.eventEmitter.emitError(error);
  }

  protected abstract runLogic(params: unknown): Promise<void>;
  protected abstract initializeState(): Promise<T>;

  /**
   * A nested run is silent: the outermost run announces everything written
   * beneath it, once, when nothing attached is left running. A detached run
   * never counts as something anyone is waiting on, so it neither stays quiet
   * for a caller nor silences the run that started it.
   *
   * Both brackets close before the blocks below run, so what is still open here
   * belongs to somebody else.
   */
  private async runWithUpdate(functionToRun: () => Promise<void>, run: RunKind): Promise<void> {
    const body = () => withMutationWindow(functionToRun);
    try {
      await (run.detached ? body() : withAttachedRun(body));
    } catch (error) {
      this.reportUnlessCallerWill(error, run);
      throw error;
    } finally {
      if (!isCallerStillRunning()) {
        this.eventEmitter.emitStateChange(deepReadonly(currentScope().state as object));
      }
    }
  }

  /**
   * Counting who is running cannot tell a caller from an unrelated run that
   * happens to overlap, and guessing wrong loses the failure entirely. Whether
   * this run has a caller is known when it starts, so that is what decides.
   */
  private reportUnlessCallerWill(error: unknown, run: RunKind) {
    if (run.hasCaller) return;
    this.report(error instanceof Error ? error : new Error(String(error)));
  }
}
