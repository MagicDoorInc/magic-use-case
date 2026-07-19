import { deepReadonly } from './deepReadonly';
import { type EventEmitter, eventEmitter } from './eventEmitter';

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
    try {
      if (!this.isAppStateInitialized()) {
        if (!UseCase.initialStatePromise) {
          UseCase.initialStatePromise = this.initializeState().then((state) => {
            UseCase.state = state;
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
    return UseCase.state as T;
  }

  protected navigate(url: string) {
    this.eventEmitter?.emitNavigation(url);
  }

  protected abstract isAppStateInitialized(): boolean;
  protected abstract runLogic(params: unknown): Promise<void>;
  protected abstract initializeState(): Promise<T>;

  protected async runWithUpdate(functionToRun: () => Promise<void>): Promise<void> {
    await functionToRun();
    this.eventEmitter?.emitStateChange(deepReadonly(UseCase.state as object));
  }
}
