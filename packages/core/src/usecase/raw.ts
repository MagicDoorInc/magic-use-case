export const RAW = Symbol('raw');

export function toRaw<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  return ((value as Record<symbol, unknown>)[RAW] as T | undefined) ?? value;
}
