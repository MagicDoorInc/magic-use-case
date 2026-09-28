export const RAW = Symbol('raw');

export function toRaw<T extends object>(value: T): T {
  return ((value as Record<symbol, unknown>)[RAW] as T | undefined) ?? value;
}
