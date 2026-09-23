import { createUseCase, type UseCaseClass } from '@magicdoor/magic-use-case-core';
import { createSignal } from 'solid-js';

export function useUseCase<T>(UseCaseClass: UseCaseClass<T>) {
  const [isLoading, setIsLoading] = createSignal(false);
  const [progress, setProgress] = createSignal(0);

  const useCase = createUseCase(UseCaseClass, setProgress);

  const execute = async (params?: unknown): Promise<boolean> => {
    setIsLoading(true);
    try {
      await useCase.execute(params);
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  return { execute, isLoading, progress };
}
