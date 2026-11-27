import type {
  IAbapConnection,
  ICriticalSection,
} from '@mcp-abap-adt/interfaces-adt-connection';

/**
 * Open the connection's critical section and return a function that closes it.
 *
 * A disposer rather than a `withCriticalSection(fn)` wrapper on purpose: the
 * wrapper form puts the handler body inside an arrow function, and TypeScript
 * drops the narrowing done by the guard clauses above it. Every handler would
 * then need its narrowed values re-captured, which is a lot of churn to buy
 * nothing. This form leaves the body untouched:
 *
 * ```ts
 * const endCriticalSection = beginCriticalSection(this.connection);
 * try {
 *   // lock … update … unlock, unchanged
 * } finally {
 *   endCriticalSection();
 * }
 * ```
 *
 * Calling the disposer twice is harmless; it closes once. That matters because
 * the connector counts nesting, and an unbalanced count would silently extend
 * the protection over every later request on the connection.
 */
export function beginCriticalSection(connection: IAbapConnection): () => void {
  // `beginCriticalSection` is deliberately NOT part of `IAbapConnection`: how a
  // transport protects a window is its own implementation concern, and an RFC
  // or batch connection has no reason to offer one. So this asks the
  // connection whether it can — the contract's `ICriticalSection` atom, read
  // with `in` and `typeof`, which the compiler checks — and proceeds either way.
  if (
    !('beginCriticalSection' in connection) ||
    typeof connection.beginCriticalSection !== 'function' ||
    !('endCriticalSection' in connection) ||
    typeof connection.endCriticalSection !== 'function'
  ) {
    return () => {};
  }
  const { beginCriticalSection: begin, endCriticalSection: end } = connection;
  begin.call(connection);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    end.call(connection);
  };
}
