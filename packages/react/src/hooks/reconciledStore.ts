import { useState, useCallback } from 'react';

export function useReconciledStore<T>(initialState: T | (() => T)) {
  // A function is passed through as React's lazy initializer, so a caller that
  // has to compute its first value does it once rather than on every render.
  const [state, setState] = useState<T | undefined>(initialState);

  const updateState = useCallback((newData: T | ((prev: T | undefined) => T)) => {
    setState((prevState) => {
      const resolvedState = typeof newData === 'function' ? (newData as (prev: T | undefined) => T)(prevState) : newData;
      if (prevState === undefined) {
        return resolvedState;
      }
      if (deepEqual(prevState, resolvedState)) {
        return prevState;
      } else {
        return cloneWithNewReferences(resolvedState, prevState);
      }
    });
  }, []);
  return [state, updateState] as const;
}

function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 == null || obj2 == null || typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;
  if (obj1 instanceof Date && obj2 instanceof Date) return obj1.getTime() === obj2.getTime();
  if (obj1 instanceof Set && obj2 instanceof Set) {
    if (obj1.size !== obj2.size) return false;
    const arr2 = [...obj2];
    return [...obj1].every((val) => arr2.some((val2) => deepEqual(val, val2)));
  }
  if (obj1 instanceof Map && obj2 instanceof Map) {
    if (obj1.size !== obj2.size) return false;
    return [...obj1.keys()].every((key) => obj2.has(key) && deepEqual(obj1.get(key), obj2.get(key)));
  }
  if (Object.getPrototypeOf(obj1) !== Object.getPrototypeOf(obj2)) return false;
  const rec1 = obj1 as Record<string, unknown>;
  const rec2 = obj2 as Record<string, unknown>;
  const keys1 = Object.keys(rec1);
  const keys2 = Object.keys(rec2);
  if (keys1.length !== keys2.length) return false;
  return keys1.every((key) => key in rec2 && deepEqual(rec1[key], rec2[key]));
}

function cloneWithNewReferences<T>(obj: T, referenceObj?: T): T {
  if (Array.isArray(obj) && Array.isArray(referenceObj)) {
    return obj.map((item, index) =>
      deepEqual(item, referenceObj[index]) ? referenceObj[index] : cloneWithNewReferences(item, referenceObj[index])
    ) as T;
  } else if (obj instanceof Map && referenceObj instanceof Map) {
    const newMap = new Map();
    let hasChanges = obj.size !== referenceObj.size;
    for (const [key, value] of obj) {
      const refValue = referenceObj.get(key);
      if (deepEqual(value, refValue)) {
        newMap.set(key, refValue);
      } else {
        newMap.set(key, cloneWithNewReferences(value, refValue));
        hasChanges = true;
      }
    }
    return (hasChanges ? newMap : obj) as T;
  } else if (obj instanceof Set && referenceObj instanceof Set) {
    const refArr = [...referenceObj];
    const newArr = [...obj].map((val) => {
      const match = refArr.find((ref) => deepEqual(val, ref));
      return match !== undefined ? match : val;
    });
    const hasChanges = obj.size !== referenceObj.size || newArr.some((v, i) => v !== [...obj][i]);
    return (hasChanges ? new Set(newArr) : obj) as T;
  } else if (obj && typeof obj === 'object' && obj.constructor === Object) {
    const newObj = Object.create(Object.getPrototypeOf(obj));
    let hasChanges = false;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const clonedValue =
          referenceObj && deepEqual(obj[key], referenceObj[key])
            ? referenceObj[key]
            : cloneWithNewReferences(obj[key], referenceObj ? referenceObj[key] : undefined);
        if (clonedValue !== obj[key]) hasChanges = true;
        newObj[key] = clonedValue;
      }
    }
    return hasChanges ? newObj : obj;
  }
  return obj;
}
