const READONLY = Symbol('readonly');

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

const proxyCache = new WeakMap<object, object>();

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}

function throwReadonly(action: string): never {
  throw new Error(`Cannot ${action} on readonly object`);
}

function wrapValue(value: unknown): unknown {
  return isObject(value) ? deepReadonly(value) : value;
}

function createMapProxy(target: Map<unknown, unknown>): Map<unknown, unknown> {
  return new Proxy(target, {
    get(target, prop, receiver) {
      if (prop === READONLY) return true;

      if (typeof prop === 'string' && mutatingMapMethods.has(prop)) {
        return () => throwReadonly(`call .${prop}() on readonly Map`);
      }

      if (prop === 'get') {
        return (key: unknown) => wrapValue(target.get(key));
      }

      if (prop === 'forEach') {
        return (cb: (value: unknown, key: unknown, map: Map<unknown, unknown>) => void) =>
          target.forEach((v, k) => cb(wrapValue(v), k, receiver));
      }

      if (iteratorKeys.has(prop)) {
        return function* () {
          if (prop === 'values') {
            for (const v of target.values()) yield wrapValue(v);
          } else {
            for (const [k, v] of target.entries()) yield [k, wrapValue(v)];
          }
        };
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(_, prop) { throwReadonly(`set property '${String(prop)}'`); },
    deleteProperty(_, prop) { throwReadonly(`delete property '${String(prop)}'`); },
    defineProperty(_, prop) { throwReadonly(`define property '${String(prop)}'`); },
  });
}

function createSetProxy(target: Set<unknown>): Set<unknown> {
  return new Proxy(target, {
    get(target, prop, receiver) {
      if (prop === READONLY) return true;

      if (typeof prop === 'string' && mutatingSetMethods.has(prop)) {
        return () => throwReadonly(`call .${prop}() on readonly Set`);
      }

      if (iteratorKeys.has(prop)) {
        return function* () {
          for (const v of target.values()) yield wrapValue(v);
        };
      }

      if (prop === 'forEach') {
        return (cb: (value: unknown, key: unknown, set: Set<unknown>) => void) =>
          target.forEach((v) => cb(wrapValue(v), wrapValue(v), receiver));
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(_, prop) { throwReadonly(`set property '${String(prop)}'`); },
    deleteProperty(_, prop) { throwReadonly(`delete property '${String(prop)}'`); },
    defineProperty(_, prop) { throwReadonly(`define property '${String(prop)}'`); },
  });
}

function createObjectProxy(target: object): object {
  return new Proxy(target, {
    get(target, prop, receiver) {
      if (prop === READONLY) return true;

      if (Array.isArray(target) && typeof prop === 'string' && mutatingArrayMethods.has(prop)) {
        return () => throwReadonly(`call .${prop}() on readonly Array`);
      }

      const value = Reflect.get(target, prop, receiver);
      return isObject(value) ? deepReadonly(value) : value;
    },
    set(_, prop) { throwReadonly(`set property '${String(prop)}'`); },
    deleteProperty(_, prop) { throwReadonly(`delete property '${String(prop)}'`); },
    defineProperty(_, prop) { throwReadonly(`define property '${String(prop)}'`); },
  });
}

export function deepReadonly<T extends object>(obj: T): DeepReadonly<T> {
  if (obj === null || typeof obj !== 'object') return obj as DeepReadonly<T>;
  if ((obj as Record<symbol, unknown>)[READONLY]) return obj as DeepReadonly<T>;
  if (proxyCache.has(obj)) return proxyCache.get(obj) as DeepReadonly<T>;

  let proxy: object;

  if (obj instanceof Map) {
    proxy = createMapProxy(obj as Map<unknown, unknown>);
  } else if (obj instanceof Set) {
    proxy = createSetProxy(obj as Set<unknown>);
  } else {
    proxy = createObjectProxy(obj);
  }

  proxyCache.set(obj, proxy);
  return proxy as DeepReadonly<T>;
}
