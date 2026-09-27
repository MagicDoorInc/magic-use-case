import { createUseCase, type UseCaseArgs, type UseCaseClass } from '@magicdoor/magic-use-case-core';
import { createSignal } from 'solid-js';

export function useUseCase<T, P = void>(UseCaseClass: UseCaseClass<T, P>) {
  const [isLoading, setIsLoading] = createSignal(false);
  const [progress, setProgress] = createSignal(0);

  const useCase = createUseCase(UseCaseClass, setProgress);

  const execute = async (...params: UseCaseArgs<P>): Promise<boolean> => {
    setIsLoading(true);
    let succeeded = true;
    try {
      await useCase.execute(...params);
    } catch {
      succeeded = false;
    }
    setIsLoading(false);
    return succeeded;
  };
  return { execute, isLoading, progress };
}
