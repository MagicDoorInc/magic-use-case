import { type Presenter } from '@magic-use-case/core';
import { useEffect, useRef, useCallback } from 'react';
import { useReconciledStore } from './reconciledStore';

export function usePresenter<T extends object>(PresenterClass: new () => Presenter<T>) {
  const [model, setModel] = useReconciledStore<T | undefined>(undefined);

  const presenterRef = useRef<Presenter<T>>(undefined);
  if (!presenterRef.current) {
    presenterRef.current = new PresenterClass();
  }

  const updateModel = useCallback(
    (newModel: T | undefined) => {
      setModel(newModel);
    },
    [setModel]
  );

  useEffect(() => {
    if (!presenterRef.current) return;
    presenterRef.current.subscribe(updateModel);
    return () => {
      presenterRef.current?.unsubscribe(updateModel);
      presenterRef.current?.destroy();
      presenterRef.current = undefined;
    };
  }, [updateModel]);
  return { model };
}
