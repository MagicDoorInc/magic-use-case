import { deepReadonly, useCaseWritable } from './deepReadonly';
import { type EventEmitter, eventEmitter } from './eventEmitter';
import { assertNotOnServer } from './serverGuard';
import { withMutationWindow, assertMutationWindowOpen } from './mutationWindow';
import { deepClone } from './deepClone';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UseCaseClass<T> = new (...args: any[]) => UseCase<T>;

export function createUseCase<T>(
  UseCaseClass: UseCaseClass<T>,
  onProgress?: (value: number) => void
): UseCase<T> {
  return new (UseCaseClass as new (eventEmitter?: EventEmitter, onProgress?: (value: number) => void) => UseCase<T>)(eventEmitter, onProgress);
}

export abstract class UseCase<T> {
  private static state: unknown;
  protected eventEmitter?: EventEmitter;
  protected onProgress?: (progress: number) => void;

  // Keyed by constructor identity, so `object` is sufficient and avoids the
  // unsafe `Function` type.
  private static runningUseCases = new Map<object, Map<string, Promise<void>>>();
  private static initialStatePromise?: Promise<void>;

  constructor(eventEmitter?: EventEmitter, onProgress?: (progress: number) => void) {
    this.eventEmitter = eventEmitter;
    this.onProgress = onProgress;
  }

  public async execute(params?: unknown): Promise<boolean> {
    // Deliberately outside the try below: this must propagate to the caller,
    // not be captured and reported as a failed execution.
    assertNotOnServer('Executing a use case');
    try {
      // Bootstrap exactly once. Core owns this decision: a subclass cannot
      // force a re-initialization and silently replace live state. Clearing
      // state is what `resetAppState()` is for.
      if (UseCase.state === undefined) {
        if (!UseCase.initialStatePromise) {
          UseCase.initialStatePromise = this.initializeState().then((state) => {
            // Adopted, not borrowed: the caller keeps their object, but it is
            // no longer application state and writing to it has no effect.
            UseCase.state = deepClone(state);
          });
        }
        try {
          await UseCase.initialStatePromise;
        } finally {
          UseCase.initialStatePromise = undefined;
        }
      }
      const classMap = UseCase.runningUseCases.get(this.constructor) ?? new Map<string, Promise<void>>();
      UseCase.runningUseCases.set(this.constructor, classMap);
      const paramsKey = JSON.stringify(params);
      if (classMap.has(paramsKey)) {
        await classMap.get(paramsKey);
        return true;
      }
      const executionPromise = this.runWithUpdate(() => this.runLogic(params));
      classMap.set(paramsKey, executionPromise);
      try {
        await executionPromise;
      } finally {
        classMap.delete(paramsKey);
        if (classMap.size === 0) {
          UseCase.runningUseCases.delete(this.constructor);
        }
      }
      return true;
    } catch (error) {
      this.eventEmitter?.emitError(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  protected getState(): T {
    assertNotOnServer('Reading use case state');
    return useCaseWritable(UseCase.state as object) as T;
  }

  /**
   * Clears application state so the next execution bootstraps it again.
   *
   * All four pieces of module state go together: the state itself, the
   * emitter's retained copy, the in-flight dedup map, and any bootstrap in
   * flight. Leaving any one behind resurrects the old state.
   */
  protected resetAppState(): void {
    assertNotOnServer('Resetting application state');
    assertMutationWindowOpen('Resetting application state');

    UseCase.state = undefined;
    UseCase.runningUseCases.clear();
    UseCase.initialStatePromise = undefined;
    this.eventEmitter?.resetState();
  }

  protected navigate(url: string) {
    this.eventEmitter?.emitNavigation(url);
  }

  protected abstract runLogic(params: unknown): Promise<void>;
  protected abstract initializeState(): Promise<T>;

  protected async runWithUpdate(functionToRun: () => Promise<void>): Promise<void> {
    await withMutationWindow(functionToRun);
    this.eventEmitter?.emitStateChange(deepReadonly(UseCase.state as object));
  }
}
