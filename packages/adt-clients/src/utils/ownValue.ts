/**
 * Reading values from outside the type system — what a connection threw, a
 * field a contract types `unknown` — under the two access policies the code
 * used before #304, each kept where it was used (spec section 3.5).
 */

/**
 * An own data property, never an inherited one and never a getter: a getter
 * is not run. `undefined` for anything that is not an object.
 */
export function ownValue(holder: unknown, key: string): unknown {
  if (holder === null || typeof holder !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(holder, key);
  if (descriptor === undefined || !('value' in descriptor)) return undefined;
  const value: unknown = descriptor.value;
  return value;
}

/**
 * A property as a direct read `holder?.key` reads it: inherited properties
 * and getters included, from an object or a function; `undefined` from a
 * primitive, `null` or `undefined`.
 */
export function propertyOf(holder: unknown, key: string): unknown {
  if (
    (typeof holder !== 'object' && typeof holder !== 'function') ||
    holder === null
  )
    return undefined;
  const value: unknown = Reflect.get(holder, key);
  return value;
}

/** The value when it is a number, else `undefined`. */
export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/** The value when it is a string, else `undefined`. */
export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
