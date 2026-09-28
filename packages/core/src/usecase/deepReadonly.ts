import { isMutationWindowOpen, recordWrite, recordWriteOfEverythingUnder } from './mutationWindow';
import { KEYS, WHOLE, recordRead, recordReadOfEverythingUnder } from './dependencies';
import { RAW, toRaw } from './raw';

export { toRaw };

const mutatingMapMethods = new Set(['set', 'delete', 'clear']);
const mutatingSetMethods = new Set(['add', 'delete', 'clear']);
const mutatingArrayMethods = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
]);
const iteratorKeys = new Set<string | symbol>(['values', 'entries', Symbol.iterator]);

type AnyFunction = (...args: never[]) => unknown;

/** What a presentation's model looks like to the screen rendering it. */
export type DeepReadonly<T> =
  T extends AnyFunction ? T :
  T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<K, DeepReadonly<V>> :
  T extends ReadonlySet<infer V> ? ReadonlySet<DeepReadonly<V>> :
  T extends ReadonlyArray<infer V> ? ReadonlyArray<DeepReadonly<V>> :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

/**
 * Both wrappers below are the same deep proxy over application state; they
 * differ only in when a write is permitted. `READONLY` never permits one — it
 * is the view handed to presenters. `USE_CASE` permits writes only while a use
 * case is running, and is what `getState()` returns.
 */
interface Policy {
  marker: symbol;
  cache: WeakMap<object, object>;
  /** Prefixes the collection name in messages, e.g. "readonly Array". */
  label: string;
  allows(): boolean;
  tracksReads: boolean;
  usedWhole(target: object): void;
  reject(action: string): never;
}

const READONLY: Policy = {
  marker: Symbol('readonly'),
  cache: new WeakMap<object, object>(),
  label: 'readonly ',
  allows: () => false,
  tracksReads: true,
  usedWhole: recordReadOfEverythingUnder,
  reject(action) {
    throw new Error(`Cannot ${action} on readonly object`);
  },
};

const USE_CASE: Policy = {
  marker: Symbol('useCaseWritable'),
  cache: new WeakMap<object, object>(),
  label: '',
  allows: isMutationWindowOpen,
  tracksReads: false,
  usedWhole: recordWriteOfEverythingUnder,
  reject(action) {
    throw new Error(
      `Cannot ${action} outside a use case.\n\n` +
        'Application state may only be mutated from within a running use case, ' +
        'so that every change emits a state-change event and reaches the UI. ' +
        'Mutating it elsewhere would leave presenters showing stale data.\n\n' +
        'Move this write into a use case\'s runLogic().',
    );
  },
};

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}

/**
 * A Proxy `get` trap must return the target's exact value for a property that
 * is both non-writable and non-configurable — which is what `Object.freeze`
 * produces. Wrapping such a value would throw a TypeError, so it is handed back
 * unwrapped. The property is already immutable at that slot, so nothing is lost
 * for a deeply frozen state; a shallowly frozen one keeps its nested objects
 * writable, which is the caller's choice to make.
 */
function mustReturnRaw(target: object, prop: string | symbol): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(target, prop);
  return descriptor !== undefined
    && descriptor.configurable === false
    && descriptor.writable === false;
}

export function isBlob(value: object): boolean {
  const tag = Object.prototype.toString.call(value);
  return tag === '[object Blob]' || tag === '[object File]';
}

function isAccessor(target: object, prop: PropertyKey): boolean {
  for (let object: object | null = target; object; object = Object.getPrototypeOf(object) as object | null) {
    const descriptor = Object.getOwnPropertyDescriptor(object, prop);
    if (descriptor) return descriptor.get !== undefined || descriptor.set !== undefined;
  }
  return false;
}

function read(policy: Policy, target: object, prop: PropertyKey | typeof WHOLE) {
  if (!policy.tracksReads) return;
  if (prop !== WHOLE && !Array.isArray(target) && isAccessor(target, prop)) {
    policy.usedWhole(target);
    return;
  }
  recordRead(target, prop);
}

function refused(target: object, action: string): never {
  const reason = Object.isFrozen(target)
    ? 'the object is frozen. Replace it in state instead of changing it'
    : !Object.isExtensible(target)
      ? 'the object is sealed. Replace it in state instead of adding to it'
      : 'the property is read-only';
  throw new Error(`Cannot ${action}: ${reason}.`);
}

function collectionMutator(target: object, name: string, method: (...args: unknown[]) => unknown) {
  return (...args: unknown[]) => {
    if (Array.isArray(target) && Object.isFrozen(target)) refused(target, `call .${name}() on an array`);
    recordWrite(target, WHOLE);
    return method.apply(target, args);
  };
}

function method(target: object, fn: (...args: unknown[]) => unknown, policy: Policy) {
  return (...args: unknown[]) => {
    policy.usedWhole(target);
    return fn.apply(target, args);
  };
}

function wroteKey(target: object, prop: string | symbol, keysChanged: boolean) {
  if (Array.isArray(target)) {
    recordWrite(target, WHOLE);
    return;
  }
  recordWrite(target, prop);
  if (keysChanged) recordWrite(target, KEYS);
}

function setRecorded(target: object, prop: string | symbol, value: unknown, policy: Policy): boolean {
  if (isAccessor(target, prop)) {
    if (!Reflect.set(target, prop, value)) refused(target, `set '${String(prop)}'`);
    policy.usedWhole(target);
    return true;
  }
  const own = Object.getOwnPropertyDescriptor(target, prop);
  const unchanged = own !== undefined && Object.is(own.value, value);
  if (!Reflect.set(target, prop, value)) refused(target, `set '${String(prop)}'`);
  if (!unchanged) wroteKey(target, prop, own === undefined);
  return true;
}

function deleteRecorded(target: object, prop: string | symbol): boolean {
  const existed = Object.prototype.hasOwnProperty.call(target, prop);
  if (!Reflect.deleteProperty(target, prop)) refused(target, `delete '${String(prop)}'`);
  if (existed) wroteKey(target, prop, true);
  return true;
}

function defineRecorded(target: object, prop: string | symbol, attributes: PropertyDescriptor): boolean {
  if (!Reflect.defineProperty(target, prop, attributes)) refused(target, `define '${String(prop)}'`);
  wroteKey(target, prop, true);
  return true;
}

function wrap(value: unknown, policy: Policy): unknown {
  return isObject(value) ? proxyFor(value, policy) : value;
}

function createMapProxy(target: Map<unknown, unknown>, policy: Policy): Map<unknown, unknown> {
  return new Proxy(target, {
    get(target, prop, receiver) {
      if (prop === RAW) return target;
      if (prop === policy.marker) return true;
      read(policy, target, WHOLE);

      if (typeof prop === 'string' && mutatingMapMethods.has(prop)) {
        if (!policy.allows()) return () => policy.reject(`call .${prop}() on ${policy.label}Map`);
        const method = Reflect.get(target, prop, target) as (...args: unknown[]) => unknown;
        return collectionMutator(target, prop, method);
      }

      if (prop === 'get') {
        return (key: unknown) => wrap(target.get(key), policy);
      }

      if (prop === 'forEach') {
        return (cb: (value: unknown, key: unknown, map: Map<unknown, unknown>) => void) =>
          target.forEach((v, k) => cb(wrap(v, policy), k, receiver));
      }

      if (iteratorKeys.has(prop)) {
        return function* () {
          if (prop === 'values') {
            for (const v of target.values()) yield wrap(v, policy);
          } else {
            for (const [k, v] of target.entries()) yield [k, wrap(v, policy)];
          }
        };
      }

      const value = Reflect.get(target, prop, target);
      if (prop === 'constructor' || typeof value !== 'function') return value;
      return value.bind(target);
    },
    set(target, prop, value) {
      if (!policy.allows()) policy.reject(`set property '${String(prop)}'`);
      return setRecorded(target, prop, value, policy);
    },
    deleteProperty(target, prop) {
      if (!policy.allows()) policy.reject(`delete property '${String(prop)}'`);
      return deleteRecorded(target, prop);
    },
    defineProperty(target, prop, attributes) {
      if (!policy.allows()) policy.reject(`define property '${String(prop)}'`);
      return defineRecorded(target, prop, attributes);
    },
  });
}

function createSetProxy(target: Set<unknown>, policy: Policy): Set<unknown> {
  return new Proxy(target, {
    get(target, prop, receiver) {
      if (prop === RAW) return target;
      if (prop === policy.marker) return true;
      read(policy, target, WHOLE);

      if (typeof prop === 'string' && mutatingSetMethods.has(prop)) {
        if (!policy.allows()) return () => policy.reject(`call .${prop}() on ${policy.label}Set`);
        const method = Reflect.get(target, prop, target) as (...args: unknown[]) => unknown;
        return collectionMutator(target, prop, method);
      }

      if (iteratorKeys.has(prop)) {
        return function* () {
          for (const v of target.values()) yield wrap(v, policy);
        };
      }

      if (prop === 'forEach') {
        return (cb: (value: unknown, key: unknown, set: Set<unknown>) => void) =>
          target.forEach((v) => cb(wrap(v, policy), wrap(v, policy), receiver));
      }

      const value = Reflect.get(target, prop, target);
      if (prop === 'constructor' || typeof value !== 'function') return value;
      return value.bind(target);
    },
    set(target, prop, value) {
      if (!policy.allows()) policy.reject(`set property '${String(prop)}'`);
      return setRecorded(target, prop, value, policy);
    },
    deleteProperty(target, prop) {
      if (!policy.allows()) policy.reject(`delete property '${String(prop)}'`);
      return deleteRecorded(target, prop);
    },
    defineProperty(target, prop, attributes) {
      if (!policy.allows()) policy.reject(`define property '${String(prop)}'`);
      return defineRecorded(target, prop, attributes);
    },
  });
}

function createObjectProxy(target: object, policy: Policy): object {
  return new Proxy(target, {
    get(target, prop, receiver) {
      if (prop === RAW) return target;
      if (prop === policy.marker) return true;

      if (Array.isArray(target) && typeof prop === 'string' && mutatingArrayMethods.has(prop)) {
        if (!policy.allows()) return () => policy.reject(`call .${prop}() on ${policy.label}Array`);
        const method = Reflect.get(target, prop, target) as (...args: unknown[]) => unknown;
        return collectionMutator(target, prop, method);
      }

      // Read as the target, not as the proxy. A native accessor — a `File`'s
      // name, a `Date`'s time — refuses to run for anything but the object it
      // belongs to, and a method handed out unbound would be called with the
      // proxy as `this` and refuse the same way.
      const value = Reflect.get(target, prop, target);
      read(policy, target, prop);
      if (mustReturnRaw(target, prop)) return value;
      if (typeof value === 'function') {
        if (prop === 'constructor') return value;
        if (Array.isArray(target)) return value.bind(policy.tracksReads ? receiver : target);
        return method(target, value as (...args: unknown[]) => unknown, policy);
      }
      if (!isObject(value)) return value;
      return proxyFor(value, policy);
    },
    set(target, prop, value) {
      if (!policy.allows()) policy.reject(`set property '${String(prop)}'`);
      return setRecorded(target, prop, value, policy);
    },
    deleteProperty(target, prop) {
      if (!policy.allows()) policy.reject(`delete property '${String(prop)}'`);
      return deleteRecorded(target, prop);
    },
    defineProperty(target, prop, attributes) {
      if (!policy.allows()) policy.reject(`define property '${String(prop)}'`);
      return defineRecorded(target, prop, attributes);
    },
    has(target, prop) {
      read(policy, target, prop);
      return Reflect.has(target, prop);
    },
    ownKeys(target) {
      read(policy, target, Array.isArray(target) ? WHOLE : KEYS);
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, prop) {
      read(policy, target, prop);
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });
}

function proxyFor<T extends object>(obj: T, policy: Policy): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if ((obj as Record<symbol, unknown>)[policy.marker]) return obj;
  if (isBlob(obj)) return obj;

  const cached = policy.cache.get(obj);
  if (cached) return cached as T;

  let proxy: object;
  if (obj instanceof Map) {
    proxy = createMapProxy(obj as Map<unknown, unknown>, policy);
  } else if (obj instanceof Set) {
    proxy = createSetProxy(obj as Set<unknown>, policy);
  } else {
    proxy = createObjectProxy(obj, policy);
  }

  policy.cache.set(obj, proxy);
  return proxy as T;
}

/** The view handed to presenters: never writable. */
export function deepReadonly<T extends object>(obj: T): DeepReadonly<T> {
  return proxyFor(obj, READONLY) as DeepReadonly<T>;
}

/** The view returned by `getState()`: writable only while a use case runs. */
export function useCaseWritable<T extends object>(obj: T): T {
  return proxyFor(obj, USE_CASE);
}
