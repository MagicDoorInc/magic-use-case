import { createStore, reconcile, type Store } from 'solid-js/store';

export function createReconciledStore<T extends object>(
  initialData: T
): [Store<T>, (data: T | Partial<T> | ((prev: T) => T | Partial<T>)) => void] {
  const [store, setStore] = createStore<T>(initialData);

  const updateStore: (data: T | Partial<T> | ((prev: T) => T | Partial<T>)) => void = (data) => {
    if (typeof data === 'function') {
      const newData = (data as (prev: T) => T)(store);
      setStore(reconcile(newData));
    } else {
      setStore(reconcile(data as T));
    }
  };

  return [store, updateStore];
}
