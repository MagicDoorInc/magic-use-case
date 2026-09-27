import { deepReadonly, isBlob, useCaseWritable } from './deepReadonly';
import { currentScope } from './appScope';
import { type EventEmitter } from './eventEmitter';
import { withMutationWindow, assertMutationWindowOpen } from './mutationWindow';
import { deepClone } from './deepClone';
import { noChanges } from './dependencies';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UseCaseClass<T, P = void> = new (...args: any[]) => UseCase<T, P>;

export type UseCaseArgs<P> = undefined extends P ? [params?: P] : [params: P];

interface RunKind {
  /** Somebody up the stack receives the exception and decides what it means. */
  hasCaller: boolean;
  writesAtStart: number;
}

/**
 * Runs nobody is waiting on. Their failures reach no caller, so they are the
 * ones that report. A use case constructed any other way is assumed to have a
 * caller who will handle its exception.
 */
const entryPoints = new WeakSet<object>();

const blobIds = new WeakMap<object, number>();
let nextBlobId = 0;

function keyableValue(_key: string, value: unknown): unknown {
  if (value instanceof Map) return { '\u0000map': [...value] };
  if (value instanceof Set) return { '\u0000set': [...value] };
  if (value === null || typeof value !== 'object' || !isBlob(value)) return value;
  let id = blobIds.get(value);
  if (id === undefined) {
    id = nextBlobId++;
    blobIds.set(value, id);
  }
  return `\u0000blob:${id}`;
}

function deduplicationKey(params: unknown): string {
  return JSON.stringify(params, keyableValue) ?? '';
}

export function createUseCase<T, P = void>(
  UseCaseClass: UseCaseClass<T, P>,
  onProgress?: (value: number) => void
): UseCase<T, P> {
  const useCase = new (UseCaseClass as new (onProgress?: (value: number) => void) => UseCase<T, P>)(onProgress);
  entryPoints.add(useCase);
  return useCase;
}

export abstract class UseCase<T, P = void> {
  protected onProgress?: (progress: number) => void;

  constructor(onProgress?: (progress: number) => void) {
    this.onProgress = onProgress;
  }

  /** Resolved per emit, so an execution always announces on the scope it is running in. */
  private get eventEmitter(): EventEmitter {
    return currentScope().emitter;
  }

  public execute(...[params]: UseCaseArgs<P>): Promise<void> {
    return this.run(params as P, { hasCaller: !entryPoints.has(this) });
  }

  /**
   * Starts a use case that this one does not wait for. It runs on its own: the
   * caller returns and announces its own changes immediately, and the detached
   * run announces its own when it lands. Nobody is waiting on it, so its failure
   * is reported rather than thrown.
   */
  protected detach<Q>(UseCaseClass: UseCaseClass<T, Q>, ...[params]: UseCaseArgs<Q>): void {
    // Reported on its way out, so there is nothing left for a rejection to tell
    // anyone — and nobody is holding the promise to hear it.
    void createUseCase(UseCaseClass)
      .run(params as Q, { hasCaller: false })
      .catch(() => undefined);
  }

  private async run(params: P, { hasCaller }: Pick<RunKind, 'hasCaller'>): Promise<void> {
    // Captured once: everything this execution touches belongs to the scope it
    // started in, however many times it awaits.
    const scope = currentScope();
    const run: RunKind = { hasCaller, writesAtStart: scope.writes };
    // Bootstrap exactly once. Core owns this decision: a subclass cannot
    // force a re-initialization and silently replace live state. Clearing
    // state is what `resetAppState()` is for.
    if (scope.state === undefined) {
      if (!scope.initialStatePromise) {
        scope.initialStatePromise = this.initializeState().then((state) => {
          // Adopted, not borrowed: the caller keeps their object, but it is
          // no longer application state and writing to it has no effect.
          scope.state = deepClone(state);
          scope.writes += 1;
          scope.changes.everything = true;
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
    const paramsKey = deduplicationKey(params);
    const classMap = scope.runningUseCases.get(this.constructor) ?? new Map<string, Promise<void>>();
    scope.runningUseCases.set(this.constructor, classMap);
    if (classMap.has(paramsKey)) {
      // Somebody was already doing this, so there is nothing to run — but the
      // work still landed for this caller, and if nobody is waiting on it then
      // this is the run that has to say so. The one it joined may be nested,
      // and nested runs stay quiet.
      await classMap.get(paramsKey);
      this.announceUnlessCallerWill(run);
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
    scope.writes += 1;
    scope.changes.everything = true;
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
  protected report(error: unknown) {
    this.eventEmitter.emitError(error instanceof Error ? error : new Error(String(error)));
  }

  protected abstract runLogic(params: P): Promise<void>;
  protected abstract initializeState(): Promise<T>;

  /**
   * A run announces its work unless somebody is waiting on it. A nested run
   * stays silent and its caller announces everything written beneath it, once.
   *
   * Whether a run has a caller is known when it starts, which is what keeps an
   * unrelated run finishing at the same moment from being swallowed: two flows
   * a screen started independently each reach it on their own.
   */
  private async runWithUpdate(functionToRun: () => Promise<void>, run: RunKind): Promise<void> {
    try {
      await withMutationWindow(functionToRun);
    } catch (error) {
      this.reportUnlessCallerWill(error, run);
      throw error;
    } finally {
      this.announceUnlessCallerWill(run);
    }
  }

  private announceUnlessCallerWill(run: RunKind) {
    const scope = currentScope();
    if (run.hasCaller || scope.writes === run.writesAtStart) return;
    scope.announcedChanges = scope.changes;
    scope.changes = noChanges();
    try {
      this.eventEmitter.emitStateChange(deepReadonly(scope.state as object));
    } finally {
      scope.announcedChanges = undefined;
    }
  }

  /**
   * Counting who is running cannot tell a caller from an unrelated run that
   * happens to overlap, and guessing wrong loses the failure entirely. Whether
   * this run has a caller is known when it starts, so that is what decides.
   */
  private reportUnlessCallerWill(error: unknown, run: RunKind) {
    if (run.hasCaller) return;
    this.report(error);
  }
}
