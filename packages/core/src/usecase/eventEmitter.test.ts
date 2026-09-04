import { describe, it, expect, vi } from 'vitest';
import { createScope, currentScope, onError, onNavigation } from './appScope';

const eventEmitter = currentScope().emitter;

describe('eventEmitter', () => {
  it('delivers navigation events to subscribers', () => {
    const handler = vi.fn();
    const unsubscribe = onNavigation(handler);

    eventEmitter.emitNavigation('/tenants/42');

    expect(handler).toHaveBeenCalledWith('/tenants/42');
    unsubscribe();
  });

  it('stops delivering after unsubscribe', () => {
    const handler = vi.fn();
    onNavigation(handler)();

    eventEmitter.emitNavigation('/ignored');

    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers errors to subscribers', () => {
    const handler = vi.fn();
    const unsubscribe = onError(handler);
    const error = new Error('boom');

    eventEmitter.emitError(error);

    expect(handler).toHaveBeenCalledWith(error);
    unsubscribe();
  });

  it('logs rather than throws when an error has no subscriber', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => eventEmitter.emitError(new Error('unhandled'))).not.toThrow();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('replays the most recent state to late stateChange subscribers', () => {
    const handler = vi.fn();
    eventEmitter.emitStateChange({ count: 1 });

    eventEmitter.registerForStateChange(handler);

    expect(handler).toHaveBeenCalledWith({ count: 1 });
    eventEmitter.unregisterFromStateChange(handler);
  });

  it('isolates a throwing handler from other subscribers', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = vi.fn();
    const bad = vi.fn(() => {
      throw new Error('handler blew up');
    });

    const un1 = onNavigation(bad as unknown as (url: string) => void);
    const un2 = onNavigation(good);
    eventEmitter.emitNavigation('/still-delivered');

    expect(good).toHaveBeenCalledWith('/still-delivered');

    un1();
    un2();
    spy.mockRestore();
  });

  it('is quiet when a navigation has no subscriber at all', () => {
    expect(() => eventEmitter.emitNavigation('/nobody-is-listening')).not.toThrow();
  });

  it('drops a navigation nobody is listening for, and says so about an error', () => {
    const fresh = (createScope() as unknown as { emitter: typeof eventEmitter }).emitter;
    const console_ = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unheard = new Error('nobody');

    fresh.emitNavigation('/nobody');
    fresh.emitError(unheard);

    // A navigation nobody wanted is nothing; a failure nobody hears about is a
    // problem, so it goes to the console rather than vanishing.
    expect(console_).toHaveBeenCalledTimes(1);
    expect(console_).toHaveBeenCalledWith('Unhandled use case error:', unheard);
    console_.mockRestore();
  });

  it('shrugs off unsubscribing from something nothing ever subscribed to', () => {
    const fresh = (createScope() as unknown as { emitter: typeof eventEmitter }).emitter;

    expect(() => fresh.unregisterFromStateChange(() => undefined)).not.toThrow();
    expect(() => fresh.unregisterFromNavigation(() => undefined)).not.toThrow();
  });
});
