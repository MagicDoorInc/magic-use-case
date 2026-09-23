import { createUseCase, type UseCaseClass } from '@magicdoor/magic-use-case-core';
import { useState, useCallback, useMemo } from 'react';

export function useUseCase<T>(
  UseCaseClass: UseCaseClass<T>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const useCase = useMemo(() => createUseCase(UseCaseClass, setProgress), [UseCaseClass]);

  const execute = useCallback(
    async (params?: unknown): Promise<boolean> => {
      setIsLoading(true);
      let succeeded = true;
      try {
        await useCase.execute(params);
      } catch {
        succeeded = false;
      }
      setIsLoading(false);
      return succeeded;
    },
    [useCase]
  );

  return { execute, isLoading, progress };
}
