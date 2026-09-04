import { createUseCase, type UseCaseClass } from '@magicdoor/magic-use-case-core';
import { createSignal } from 'solid-js';

export function useUseCase<T>(UseCaseClass: UseCaseClass<T>) {
  const [isLoading, setIsLoading] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [didSucceed, setDidSucceed] = createSignal(false);

  const useCase = createUseCase(UseCaseClass, setProgress);

  const execute = async (params?: unknown) => {
    setIsLoading(true);
    setDidSucceed(false);
    try {
      await useCase.execute(params);
      setDidSucceed(true);
    } catch {
      setDidSucceed(false);
    } finally {
      setIsLoading(false);
    }
  };
  return { execute, isLoading, didSucceed, progress };
}
