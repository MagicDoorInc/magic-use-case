import { eventEmitter } from "../usecase/eventEmitter";
import { assertNotOnServer } from "../usecase/serverGuard";

export abstract class Presenter<T extends object> {
  private state: T | undefined;
  private subscribers: Set<(model?: T) => void> = new Set();
  private stateChangeHandler: (newState: unknown) => void;

  constructor() {
    // Registering replays the last emitted state, which on a server would be
    // whatever the previous request left behind.
    assertNotOnServer('Constructing a Presenter');

    this.stateChangeHandler = (newState: unknown) => {
      const newModel = this.createModel(newState);
      this.state = newModel as T;
      this.notifySubscribers();
    };
    eventEmitter.registerForStateChange(this.stateChangeHandler);
  }

  protected abstract createModel(state: unknown): T | undefined;

  public subscribe(listener: (model?: T) => void) {
    this.subscribers.add(listener);
    listener(this.state);
  }

  public unsubscribe(listener: (model?: T) => void) {
    this.subscribers.delete(listener);
  }

  private notifySubscribers() {
    this.subscribers.forEach((listener) => listener(this.state));
  }

  public destroy() {
    eventEmitter.unregisterFromStateChange(this.stateChangeHandler);
    this.subscribers.clear();
  }
}
 
