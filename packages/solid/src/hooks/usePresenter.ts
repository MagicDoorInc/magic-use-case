import { type Presenter } from '@magic-use-case/core';
import { onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import { createReconciledStore } from './reconciledStore';

export function usePresenter<T extends object>(PresenterClass: new () => Presenter<T>): { model: Accessor<T | undefined> } {
  const [model, setModel] = createReconciledStore<{ value: T | undefined }>({ value: undefined });

  const presenter = new PresenterClass();

  const updateModel = (newModel?: T) => {
    setModel({ value: newModel });
  };

  presenter.subscribe(updateModel);

  onCleanup(() => {
    presenter.unsubscribe(updateModel);
    presenter.destroy();
  });

  return { model: () => model.value };
}
