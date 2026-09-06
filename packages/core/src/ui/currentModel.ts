import { currentScope } from '../usecase/appScope';
import { deepReadonly } from '../usecase/deepReadonly';
import type { Presentation } from './Presentation';

/**
 * The model a presentation gives for the state the scope holds right now,
 * without subscribing to anything.
 *
 * An adapter whose subscription only starts after the render — React's, where
 * effects do not run on a server — needs the model during the render itself, or
 * a server-rendered page shows its empty state while the state sits right
 * there. Nothing is registered, so there is nothing to release.
 */
export function currentModelFor<TState, TModel extends object>(
  presentation: Presentation<TState, TModel>
): TModel | undefined {
  const { state } = currentScope();

  if (state === undefined) {
    return undefined;
  }

  try {
    return presentation(deepReadonly(state as object) as TState);
  } catch (error) {
    // Matching what a subscribed presentation does when it throws: the screen
    // shows its empty state, and the bug is reported rather than thrown into
    // the render that happened to be first.
    console.error('[magic-use-case] A presentation threw; its model is left empty.', error);
    return undefined;
  }
}
