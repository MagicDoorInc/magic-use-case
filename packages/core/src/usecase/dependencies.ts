import { toRaw } from './raw';

export const WHOLE = Symbol('whole');
export const KEYS = Symbol('keys');

type Touched = Set<PropertyKey> | typeof WHOLE;

export type Dependencies = WeakMap<object, Touched>;

export interface Changes {
  everything: boolean;
  objects: Map<object, Touched>;
}

export function noChanges(): Changes {
  return { everything: false, objects: new Map() };
}

let reading: Dependencies | undefined;

export function trackReads<T>(read: () => T): { result: T; dependencies: Dependencies } {
  const outer = reading;
  const dependencies: Dependencies = new WeakMap();
  reading = dependencies;
  try {
    return { result: read(), dependencies };
  } finally {
    reading = outer;
  }
}

function touch(record: { get(key: object): Touched | undefined; set(key: object, value: Touched): unknown }, target: object, prop: PropertyKey | typeof WHOLE) {
  const touched = record.get(target);
  if (touched === WHOLE) return;
  if (prop === WHOLE) {
    record.set(target, WHOLE);
  } else if (touched) {
    touched.add(prop);
  } else {
    record.set(target, new Set([prop]));
  }
}

function eachObjectUnder(root: object, visit: (object: object) => void) {
  const seen = new Set<object>();
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== 'object') continue;
    const raw = toRaw(value);
    if (seen.has(raw)) continue;
    seen.add(raw);
    visit(raw);
    if (raw instanceof Map) {
      for (const [key, entry] of raw) pending.push(key, entry);
    } else if (raw instanceof Set || Array.isArray(raw)) {
      for (const entry of raw) pending.push(entry);
    } else {
      for (const key of Reflect.ownKeys(raw)) {
        const descriptor = Object.getOwnPropertyDescriptor(raw, key);
        if (descriptor && 'value' in descriptor) pending.push(descriptor.value);
      }
    }
  }
}

export function recordRead(target: object, prop: PropertyKey | typeof WHOLE) {
  if (reading) touch(reading, toRaw(target), prop);
}

export function recordReadOfEverythingUnder(target: object) {
  const dependencies = reading;
  if (dependencies) eachObjectUnder(target, (object) => touch(dependencies, object, WHOLE));
}

export function recordChange(changes: Changes, target: object, prop: PropertyKey | typeof WHOLE) {
  touch(changes.objects, toRaw(target), prop);
}

export function recordChangeOfEverythingUnder(changes: Changes, target: object) {
  eachObjectUnder(target, (object) => touch(changes.objects, object, WHOLE));
}

export function affects(changes: Changes, dependencies: Dependencies): boolean {
  if (changes.everything) return true;
  for (const [target, changed] of changes.objects) {
    const read = dependencies.get(target);
    if (!read) continue;
    if (read === WHOLE || changed === WHOLE) return true;
    for (const prop of changed) if (read.has(prop)) return true;
  }
  return false;
}
