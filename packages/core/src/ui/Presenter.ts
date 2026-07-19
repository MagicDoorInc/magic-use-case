import { eventEmitter } from "../usecase/eventEmitter";

export abstract class Presenter<T extends object> {
  private state: T | undefined;
  private subscribers: Set<(model?: T) => void> = new Set();
  private stateChangeHandler: (newState: unknown) => void;

  constructor() {
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
 
