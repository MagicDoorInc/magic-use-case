import { currentScope, type AppScope } from "../usecase/appScope";
import { assertNotOnServer } from "../usecase/serverGuard";
import type { Presentation } from "./Presentation";
import { acquireSource, releaseSource, type PresentationSource } from "./presentationSource";

/**
 * Infrastructure, not a place for logic: it subscribes to the model built by a
 * presentation and pushes it at whoever is listening. Adapters construct it —
 * `usePresenter(presentation)` — so application code writes presentations and
 * never touches this class.
 *
 * Presenters that were given the same presentation share one run of it: the
 * model is built once per state change and handed to all of them.
 */
export class Presenter<TState, TModel extends object> {
  private model: TModel | undefined;
  private subscribers: Set<(model?: TModel) => void> = new Set();
  private presentation: Presentation<TState, TModel>;
  private source: PresentationSource | undefined;
  private onModel: (model: unknown) => void;
  // The scope it acquired from, so it releases that share wherever `destroy()`
  // is called from rather than whichever scope happens to be current then.
  private scope: AppScope;

  constructor(presentation: Presentation<TState, TModel>) {
    // Acquiring replays the last emitted state, which on a server would be
    // whatever the previous request left behind.
    assertNotOnServer('Constructing a Presenter');

    this.presentation = presentation;
    this.onModel = (model: unknown) => {
      this.model = model as TModel | undefined;
      this.notifySubscribers();
    };

    this.scope = currentScope();
    this.source = acquireSource(this.scope, presentation);
    this.model = this.source.model as TModel | undefined;
    this.source.listeners.add(this.onModel);
  }

  public subscribe(listener: (model?: TModel) => void) {
    this.subscribers.add(listener);
    listener(this.model);
  }

  public unsubscribe(listener: (model?: TModel) => void) {
    this.subscribers.delete(listener);
  }

  private notifySubscribers() {
    this.subscribers.forEach((listener) => listener(this.model));
  }

  public destroy() {
    // Releasing twice would drop a share this presenter never held, tearing the
    // presentation down under the presenters still using it.
    if (!this.source) return;

    this.source.listeners.delete(this.onModel);
    this.source = undefined;
    releaseSource(this.scope, this.presentation);
    this.subscribers.clear();
    // A destroyed presenter renders nothing further: no model for a late
    // `subscribe()` to read back, and nothing scheduled to run the
    // presentation against state from after this teardown.
    this.model = undefined;
  }
}
