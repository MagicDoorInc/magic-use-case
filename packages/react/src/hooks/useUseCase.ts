import { createUseCase, type UseCaseClass } from '@magic-use-case/core';
import { useState, useCallback, useMemo } from 'react';

export function useUseCase<T>(
  UseCaseClass: UseCaseClass<T>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [didSucceed, setDidSucceed] = useState(false);

  const useCase = useMemo(() => createUseCase(UseCaseClass, setProgress), [UseCaseClass]);

  const execute = useCallback(
    async (params?: unknown) => {
      setIsLoading(true);
      setDidSucceed(false);
      const success = await useCase.execute(params);
      setDidSucceed(success);
      setIsLoading(false);
    },
    [useCase]
  );

  return { execute, isLoading, didSucceed, progress };
}
