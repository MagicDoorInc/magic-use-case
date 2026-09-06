import type { AppScope } from '../usecase/appScope';
import { deepReadonly } from '../usecase/deepReadonly';
import type { Presentation } from './Presentation';

export interface PresentationSource {
  model: unknown;
  listeners: Set<(model: unknown) => void>;
  handler: (state: unknown) => void;
  presenters: number;
}

/**
 * One source per presentation and scope, so a presentation shared by ten screens is run
 * once per state change rather than ten times.
 *
 * Keyed by the presentation function itself — its identity as an object, never
 * anything derived from it. A minifier renames functions freely and can leave
 * two of them with the same name, or none at all, so a name-keyed registry
 * would both miss real shares and merge unrelated presentations. Object
 * identity is what survives that.
 */
export function acquireSource<TState, TModel extends object>(
  scope: AppScope,
  presentation: Presentation<TState, TModel>
): PresentationSource {
  const existing = scope.sources.get(presentation);
  if (existing) {
    existing.presenters += 1;
    return existing;
  }

  const source: PresentationSource = {
    model: undefined,
    listeners: new Set(),
    presenters: 1,
    handler: (state: unknown) => {
      // `resetAppState()` emits the absence of state, which is not a state a
      // presentation can map. Every model empties, without each presentation
      // having to guard against a value its type says it never receives.
      if (state === undefined) {
        source.model = undefined;
      } else {
        try {
          // Kept raw: an adapter's store has to own a mutable object to
          // reconcile into. Making the model unwritable is the adapter's job,
          // at the boundary where it hands the model to a component.
          source.model = presentation(state as TState);
        } catch (error) {
          // A presentation that throws is a bug in one screen's mapping, and
          // it is reported as one. It must not fail the construction that is
          // catching up — that would take down the component doing the
          // rendering — nor the emit fanning out to every other presenter.
          // Subscribers are told the model is empty so the view can show its
          // empty state rather than keep painting a stale one.
          console.error('[magic-use-case] A presentation threw; its model is left empty.', error);
          source.model = undefined;
        }
      }
      source.listeners.forEach((listener) => listener(source.model));
    },
  };

  scope.sources.set(presentation, source);
  // Registering replays the retained state, so the model is built here rather
  // than on the next change.
  scope.emitter.registerForStateChange(source.handler);

  // A scope can hold state nothing has announced yet — one created around state
  // a server render handed over. The emitter has nothing to replay, so the model
  // is built from the state the scope already has.
  if (source.model === undefined && scope.state !== undefined) {
    source.handler(deepReadonly(scope.state as object));
  }

  return source;
}

export function releaseSource<TState, TModel extends object>(
  scope: AppScope,
  presentation: Presentation<TState, TModel>
): void {
  const source = scope.sources.get(presentation);
  if (!source) return;

  source.presenters -= 1;
  if (source.presenters > 0) return;

  scope.emitter.unregisterFromStateChange(source.handler);
  scope.sources.delete(presentation);
}
