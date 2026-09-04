import { deepReadonly, Presenter, type Presentation } from '@magicdoor/magic-use-case-core';
import { useEffect, useRef, useCallback } from 'react';
import { useReconciledStore } from './reconciledStore';

/**
 * Subscribes a component to a presentation. The presentation is read once, on
 * the first render: passing a different function on a later render does not
 * swap it, the same way `useState` keeps its initial value. Close over nothing
 * that changes — a presentation derives its model from state alone.
 *
 * Components passing the same function share one run of it. An inline arrow is
 * a new function on every render, so it shares with nobody.
 */
export function usePresenter<TState, TModel extends object>(presentation: Presentation<TState, TModel>) {
  const [model, setModel] = useReconciledStore<TModel | undefined>(undefined);
  const presentationRef = useRef(presentation);

  const updateModel = useCallback(
    (newModel: TModel | undefined) => {
      setModel(newModel);
    },
    [setModel]
  );

  // The presenter belongs to the effect that subscribes it, not to the render
  // that produced it. React can throw a render away, and it remounts effects
  // without re-rendering — StrictMode does exactly that in development — so a
  // presenter held across the effect boundary is either leaked unsubscribed or
  // torn down with no render left to replace it.
  useEffect(() => {
    const presenter = new Presenter(presentationRef.current);
    presenter.subscribe(updateModel);
    return () => {
      presenter.unsubscribe(updateModel);
      presenter.destroy();
    };
  }, [updateModel]);

  // The store rebuilds the model as plain objects to keep references stable
  // for React, which drops the readonly proxy core put around it. Put it back:
  // the model belongs to every screen sharing this presentation, so a component
  // that wrote to it would rewrite what the others are rendering.
  return { model: model === undefined ? undefined : deepReadonly(model) };
}
