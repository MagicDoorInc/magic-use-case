// `File` became a global in Node 20, and these packages support Node 18. The
// same constructor has been on `node:buffer` since 18.13, so taking it from
// there is what lets this run on the oldest version the packages claim.
import { File } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { deepClone } from './deepClone';
import { deepReadonly, useCaseWritable } from './deepReadonly';

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

  it('hands out a file as itself, not behind a proxy', () => {
    const file = new File(['x'], 'roof.png', { type: 'image/png' });
    const state = { file, files: [file], byName: new Map([['roof', file]]) };

    const readonly = deepReadonly(state);
    const writable = useCaseWritable(state);

    expect(readonly.file).toBe(file);
    expect(readonly.files[0]).toBe(file);
    expect(readonly.byName.get('roof')).toBe(file);
    expect(writable.file).toBe(file);
    expect(() => structuredClone(readonly.file)).not.toThrow();
  });

  it('adopts a file into state as the same file', () => {
    const file = new File(['x'], 'roof.png');

    expect(deepClone({ file }).file).toBe(file);
  });
});
