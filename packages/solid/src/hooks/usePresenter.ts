import { deepReadonly, Presenter, type DeepReadonly, type Presentation } from '@magicdoor/magic-use-case-core';
import { onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import { createReconciledStore } from './reconciledStore';

/**
 * Subscribes a component to a presentation. The presentation is read once, when
 * the component first runs: passing a different function on a later render does
 * not swap it, the same way a component keeps the store it created.
 *
 * Components passing the same function share one run of it. An inline arrow is
 * a new function per component, so it shares with nobody.
 */
export function usePresenter<TState, TModel extends object>(
  presentation: Presentation<TState, TModel>
): { model: Accessor<DeepReadonly<TModel> | undefined> } {
  const [model, setModel] = createReconciledStore<{ value: TModel | undefined }>({ value: undefined });

  const presenter = new Presenter(presentation);

  const updateModel = (newModel?: TModel) => {
    setModel({ value: newModel });
  };

  presenter.subscribe(updateModel);

  onCleanup(() => {
    presenter.unsubscribe(updateModel);
    presenter.destroy();
  });

  // Wrapped over the store's proxy rather than under it: reads still track, and
  // the model belongs to every screen sharing this presentation, so a component
  // that wrote to it would rewrite what the others are rendering.
  return {
    model: () => {
      const current = model.value;
      return current === undefined ? undefined : (deepReadonly(current) as DeepReadonly<TModel>);
    },
  };
}
