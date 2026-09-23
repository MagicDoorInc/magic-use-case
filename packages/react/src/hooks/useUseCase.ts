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
      try {
        await useCase.execute(params);
        return true;
      } catch {
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [useCase]
  );

  return { execute, isLoading, progress };
}
