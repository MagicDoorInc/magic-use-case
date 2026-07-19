type EventHandler = (data?: unknown) => void;

export interface EventEmitter {
  registerForStateChange(handler: EventHandler): void;
  unregisterFromStateChange(handler: EventHandler): void;
  registerForNavigation(handler: EventHandler): void;
  unregisterFromNavigation(handler: EventHandler): void;
  registerForErrors(handler: EventHandler): void;
  unregisterFromErrors(handler: EventHandler): void;
  emitStateChange(data?: unknown): void;
  resetState(): void;
  emitError(error: Error): void;
  emitNavigation(url: string): void;
}

class ConcreteEventEmitter implements EventEmitter {
  private events: { [key: string]: EventHandler[] } = {};
  private stateChange = 'stateChange';
  private navigation = 'navigation';
  private error = 'error';
  private state: unknown;

  public registerForStateChange(handler: EventHandler) {
    this.register(this.stateChange, handler);
    if (this.state !== undefined) {
      handler(this.state);
    }
  }

  public unregisterFromStateChange(handler: EventHandler) {
    this.unregister(this.stateChange, handler);
  }

  public registerForNavigation(handler: EventHandler) {
    this.register(this.navigation, handler);
  }

  public unregisterFromNavigation(handler: EventHandler) {
    this.unregister(this.navigation, handler);
  }

  public registerForErrors(handler: EventHandler) {
    this.register(this.error, handler);
  }

  public unregisterFromErrors(handler: EventHandler) {
    this.unregister(this.error, handler);
  }

  public emitStateChange(data?: unknown) {
    this.state = data;
    this.emit(this.stateChange, data);
  }

  /**
   * Drops the retained state as well as notifying. Without clearing `state`,
   * `registerForStateChange` would replay the pre-reset value to any presenter
   * constructed afterwards.
   */
  public resetState() {
    this.state = undefined;
    this.emit(this.stateChange, undefined);
  }

  public emitError(error: Error) {
    if (!this.events[this.error]?.length) {
      console.error('Unhandled use case error:', error);
      return;
    }
    this.emit(this.error, error);
  }

  public emitNavigation(url: string) {
    this.emit(this.navigation, url);
  }

  private register(event: string, handler: EventHandler) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
  }

  private unregister(event: string, handler: EventHandler) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((h) => h !== handler);
  }

  private emit(event: string, data?: unknown) {
    if (!this.events[event]) return;
    this.events[event].forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    });
  }
}

export const eventEmitter = new ConcreteEventEmitter();

export function onError(handler: (error: Error) => void): () => void {
  const wrapper: EventHandler = (data?: unknown) => {
    if (data instanceof Error) handler(data);
  };
  eventEmitter.registerForErrors(wrapper);
  return () => eventEmitter.unregisterFromErrors(wrapper);
}

export function onNavigation(handler: (url: string) => void): () => void {
  const wrapper: EventHandler = (data?: unknown) => {
    if (typeof data === 'string') handler(data);
  };
  eventEmitter.registerForNavigation(wrapper);
  return () => eventEmitter.unregisterFromNavigation(wrapper);
}
