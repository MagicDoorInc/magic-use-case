import { createUseCase, type UseCaseClass } from '@magic-use-case/core';
import { createSignal } from 'solid-js';

export function useUseCase<T>(UseCaseClass: UseCaseClass<T>) {
  const [isLoading, setIsLoading] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [didSucceed, setDidSucceed] = createSignal(false);

  const useCase = createUseCase(UseCaseClass, setProgress);

  const execute = async (params?: unknown) => {
    setIsLoading(true);
    setDidSucceed(false);
    const success = await useCase.execute(params);
    setDidSucceed(success);
    setIsLoading(false);
  };
  return { execute, isLoading, didSucceed, progress };
}
