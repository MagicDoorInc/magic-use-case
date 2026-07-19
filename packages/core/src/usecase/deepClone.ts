/**
 * Deep clone that preserves prototypes, so class-based application state stays
 * class-based: `instanceof` still holds, methods still resolve, and accessors
 * remain accessors rather than being flattened to data.
 *
 * `structuredClone` cannot be used here — it returns plain objects, discarding
 * the prototype and every method on it.
 *
 * The clone exists so the object handed to `initializeState()` is adopted, not
 * borrowed: the caller keeps their reference, but it is no longer application
 * state, and writing to it has no effect.
 */

function cloneCollection(value: object, seen: WeakMap<object, unknown>): unknown {
  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy);
    for (const [k, v] of value.entries()) {
      copy.set(deepClone(k, seen), deepClone(v, seen));
    }
    return copy;
  }

  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);
    for (const v of value.values()) {
      copy.add(deepClone(v, seen));
    }
    return copy;
  }

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const v of value) copy.push(deepClone(v, seen));
    return copy;
  }

  return undefined;
}

export function deepClone<T>(value: T, seen: WeakMap<object, unknown> = new WeakMap()): T {
  if (value === null || typeof value !== 'object') return value;

  const asObject = value as unknown as object;

  // Cycles and shared references resolve to the same clone, preserving the
  // original object graph's identity relationships.
  const existing = seen.get(asObject);
  if (existing !== undefined) return existing as T;

  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as unknown as T;

  const collection = cloneCollection(asObject, seen);
  if (collection !== undefined) return collection as T;

  // Anything else: rebuild on the same prototype and copy own descriptors, so
  // getters/setters stay accessors instead of being invoked and frozen as data.
  const copy = Object.create(Object.getPrototypeOf(asObject) as object | null) as Record<
    string | symbol,
    unknown
  >;
  seen.set(asObject, copy);

  for (const key of Reflect.ownKeys(asObject)) {
    const descriptor = Object.getOwnPropertyDescriptor(asObject, key);
    if (!descriptor) continue;

    if ('value' in descriptor) {
      Object.defineProperty(copy, key, {
        ...descriptor,
        value: deepClone(descriptor.value, seen),
      });
    } else {
      // Accessor: copied as-is. It will read and write the clone's own fields.
      Object.defineProperty(copy, key, descriptor);
    }
  }

  if (Object.isFrozen(asObject)) Object.freeze(copy);
  else if (Object.isSealed(asObject)) Object.seal(copy);

  return copy as T;
}
