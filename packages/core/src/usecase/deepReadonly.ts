import { isMutationWindowOpen } from './mutationWindow';

const mutatingMapMethods = new Set(['set', 'delete', 'clear']);
const mutatingSetMethods = new Set(['add', 'delete', 'clear']);
const mutatingArrayMethods = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
]);
const iteratorKeys = new Set<string | symbol>(['values', 'entries', Symbol.iterator]);

type DeepReadonly<T> =
  T extends Map<infer K, infer V> ? ReadonlyMap<K, DeepReadonly<V>> :
  T extends Set<infer V> ? ReadonlySet<DeepReadonly<V>> :
  T extends Array<infer V> ? ReadonlyArray<DeepReadonly<V>> :
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
  reject(action: string): never;
}

const READONLY: Policy = {
  marker: Symbol('readonly'),
  cache: new WeakMap<object, object>(),
  label: 'readonly ',
  allows: () => false,
  reject(action) {
    throw new Error(`Cannot ${action} on readonly object`);
  },
};

const USE_CASE: Policy = {
  marker: Symbol('useCaseWritable'),
  cache: new WeakMap<object, object>(),
  label: '',
  allows: isMutationWindowOpen,
  reject(action) {
    throw new Error(
      `[magic-use-case] Cannot ${action} outside a use case.\n\n` +
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

function wrap(value: unknown, policy: Policy): unknown {
  return isObject(value) ? proxyFor(value, policy) : value;
}

function createMapProxy(target: Map<unknown, unknown>, policy: Policy): Map<unknown, unknown> {
  return new Proxy(target, {
    get(target, prop, receiver) {
      if (prop === policy.marker) return true;

      if (typeof prop === 'string' && mutatingMapMethods.has(prop)) {
        if (!policy.allows()) return () => policy.reject(`call .${prop}() on ${policy.label}Map`);
        const method = Reflect.get(target, prop, target) as (...args: unknown[]) => unknown;
        return method.bind(target);
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

      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, prop, value) {
      if (!policy.allows()) policy.reject(`set property '${String(prop)}'`);
      return Reflect.set(target, prop, value);
    },
    deleteProperty(target, prop) {
      if (!policy.allows()) policy.reject(`delete property '${String(prop)}'`);
      return Reflect.deleteProperty(target, prop);
    },
    defineProperty(target, prop, attributes) {
      if (!policy.allows()) policy.reject(`define property '${String(prop)}'`);
      return Reflect.defineProperty(target, prop, attributes);
    },
  });
}

function createSetProxy(target: Set<unknown>, policy: Policy): Set<unknown> {
  return new Proxy(target, {
    get(target, prop, receiver) {
      if (prop === policy.marker) return true;

      if (typeof prop === 'string' && mutatingSetMethods.has(prop)) {
        if (!policy.allows()) return () => policy.reject(`call .${prop}() on ${policy.label}Set`);
        const method = Reflect.get(target, prop, target) as (...args: unknown[]) => unknown;
        return method.bind(target);
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

      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, prop, value) {
      if (!policy.allows()) policy.reject(`set property '${String(prop)}'`);
      return Reflect.set(target, prop, value);
    },
    deleteProperty(target, prop) {
      if (!policy.allows()) policy.reject(`delete property '${String(prop)}'`);
      return Reflect.deleteProperty(target, prop);
    },
    defineProperty(target, prop, attributes) {
      if (!policy.allows()) policy.reject(`define property '${String(prop)}'`);
      return Reflect.defineProperty(target, prop, attributes);
    },
  });
}

function createObjectProxy(target: object, policy: Policy): object {
  return new Proxy(target, {
    get(target, prop, receiver) {
      if (prop === policy.marker) return true;

      if (Array.isArray(target) && typeof prop === 'string' && mutatingArrayMethods.has(prop)) {
        if (!policy.allows()) return () => policy.reject(`call .${prop}() on ${policy.label}Array`);
        const method = Reflect.get(target, prop, target) as (...args: unknown[]) => unknown;
        return method.bind(target);
      }

      const value = Reflect.get(target, prop, receiver);
      if (!isObject(value) || mustReturnRaw(target, prop)) return value;
      return proxyFor(value, policy);
    },
    set(target, prop, value) {
      if (!policy.allows()) policy.reject(`set property '${String(prop)}'`);
      return Reflect.set(target, prop, value);
    },
    deleteProperty(target, prop) {
      if (!policy.allows()) policy.reject(`delete property '${String(prop)}'`);
      return Reflect.deleteProperty(target, prop);
    },
    defineProperty(target, prop, attributes) {
      if (!policy.allows()) policy.reject(`define property '${String(prop)}'`);
      return Reflect.defineProperty(target, prop, attributes);
    },
  });
}

function proxyFor<T extends object>(obj: T, policy: Policy): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if ((obj as Record<symbol, unknown>)[policy.marker]) return obj;

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
