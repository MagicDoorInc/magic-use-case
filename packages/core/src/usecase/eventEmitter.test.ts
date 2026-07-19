import { describe, it, expect, vi } from 'vitest';
import { onError, onNavigation } from './eventEmitter';
import { eventEmitter } from './eventEmitter';

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
});
