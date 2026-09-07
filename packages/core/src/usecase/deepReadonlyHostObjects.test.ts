import { describe, expect, it } from 'vitest';
import { deepReadonly } from './deepReadonly';

/**
 * Application state holds more than plain data: a form keeps the `File` a
 * tenant attached. Reading one is a native accessor, and a native accessor
 * refuses to run for anything but the object it belongs to.
 */
describe('state holding a host object', () => {
  it('reads a file the way the presentation does', () => {
    const state = { files: [{ file: new File(['x'], 'roof.png', { type: 'image/png' }) }] };

    const readonly = deepReadonly(state) as typeof state;

    expect(readonly.files[0]!.file.name).toBe('roof.png');
    expect(readonly.files[0]!.file.type).toBe('image/png');
  });

  it('reads a date the same way', () => {
    const readonly = deepReadonly({ at: new Date('2026-01-02T03:04:05Z') }) as { at: Date };

    expect(readonly.at.toISOString()).toBe('2026-01-02T03:04:05.000Z');
  });
});
