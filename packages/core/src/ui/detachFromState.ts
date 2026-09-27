import { isBlob, toRaw } from '../usecase/deepReadonly';
import { WHOLE, recordRead } from '../usecase/dependencies';

export function detachFromState<T>(model: T): T {
  return detach(model, new Map()) as T;
}

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}

function isPlain(value: object): boolean {
  if (Array.isArray(value)) return true;
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function detach(value: unknown, seen: Map<object, unknown>): unknown {
  if (!isObject(value)) return value;

  const raw = toRaw(value);
  if (raw !== value) return copy(raw, seen);
  if (seen.has(value)) return seen.get(value);
  if (!isPlain(value)) return value;

  seen.set(value, value);
  let result = value as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    const child = (value as Record<string, unknown>)[key];
    const detached = detach(child, seen);
    if (detached === child) continue;
    if (result === value && Object.isFrozen(value)) {
      result = (Array.isArray(value) ? [...value] : { ...value }) as Record<string, unknown>;
      seen.set(value, result);
    }
    result[key] = detached;
  }
  return result;
}

function copy(value: unknown, seen: Map<object, unknown>): unknown {
  if (!isObject(value)) return value;

  const raw = toRaw(value);
  if (seen.has(raw)) return seen.get(raw);
  recordRead(raw, WHOLE);
  if (isBlob(raw) || raw instanceof RegExp) return raw;
  if (raw instanceof Date) return new Date(raw.getTime());

  if (raw instanceof Map) {
    const map = new Map();
    seen.set(raw, map);
    for (const [key, entry] of raw) map.set(key, copy(entry, seen));
    return map;
  }

  if (raw instanceof Set) {
    const set = new Set();
    seen.set(raw, set);
    for (const entry of raw) set.add(copy(entry, seen));
    return set;
  }

  if (Array.isArray(raw)) {
    const array: unknown[] = [];
    seen.set(raw, array);
    for (const entry of raw) array.push(copy(entry, seen));
    return array;
  }

  const object = Object.create(Object.getPrototypeOf(raw) as object | null) as object;
  seen.set(raw, object);
  for (const key of Reflect.ownKeys(raw)) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (!descriptor) continue;
    Object.defineProperty(
      object,
      key,
      'value' in descriptor
        ? { value: copy(descriptor.value, seen), writable: true, enumerable: descriptor.enumerable, configurable: true }
        : { ...descriptor, configurable: true },
    );
  }
  return object;
}
