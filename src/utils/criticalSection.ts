/**
 * Run the lock window as an uninterruptible critical section.
 *
 * The connector raises the effective timeout while a critical section is open
 * (`Math.max(caller timeout, SAP_TIMEOUT_CRITICAL)`), which is the whole reason
 * the mechanism exists. This package never used it: every request went out with
 * the caller's plain 45s, including the ones between LOCK and UNLOCK.
 *
 * The consequence is a matched pair of problems, and only one half was ever
 * fixed. A request inside the window times out, the handler unlocks and
 * rethrows — so the lock is released, which is the half that was solved. The
 * other half stayed: the update never happened, the object is left exactly as
 * `create()` left it (an empty shell), and nothing says so beyond a timeout
 * message. That is how an append structure came to sit in a package as
 *
 * ```
 * extend type zac_shr_appstru with zadt_s_append_s {
 * }
 * ```
 *
 * `beginCriticalSection` is deliberately NOT part of `IAbapConnection`: how a
 * transport protects a window is its own implementation concern, and an RFC or
 * batch connection has no reason to offer one. So this asks the connection
 * whether it can, and proceeds either way — a transport that cannot protect the
 * window is not blocked from doing the work.
 */
interface ICriticalSectionCapable {
  beginCriticalSection(): void;
  endCriticalSection(): void;
}

function supportsCriticalSection(
  connection: unknown,
): connection is ICriticalSectionCapable {
  const candidate = connection as Partial<ICriticalSectionCapable>;
  return (
    typeof candidate?.beginCriticalSection === 'function' &&
    typeof candidate?.endCriticalSection === 'function'
  );
}

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
export function beginCriticalSection(connection: unknown): () => void {
  if (!supportsCriticalSection(connection)) {
    return () => {};
  }
  connection.beginCriticalSection();
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    connection.endCriticalSection();
  };
}
