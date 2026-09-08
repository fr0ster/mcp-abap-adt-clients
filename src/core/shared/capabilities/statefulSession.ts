import type { IAbapConnection } from '@mcp-abap-adt/interfaces';

/** The part of a connection this helper touches, so a caller can pass a stub. */
type SessionSwitchable = Pick<IAbapConnection, 'setSessionType'>;

/**
 * Run one request inside a stateful session, and put the session back whatever
 * happens.
 *
 * **Why this exists as a function rather than as a rule people follow.** The
 * pattern it replaces was written out by hand at forty-one places, and at every
 * one of them the restore was the last statement of the success path:
 *
 * ```typescript
 * connection.setSessionType('stateful');
 * const handle = await lockClass(connection, name);   // throws → never restored
 * connection.setSessionType('stateless');
 * ```
 *
 * A refused `LOCK` — an object someone else holds, an expired session, a
 * network error — skipped the restore and left the connection stateful. The
 * connection is shared, so that is not a leak confined to the failing caller:
 * the next unrelated request goes out inside a session nobody asked for, and
 * what the server takes during it is held until that session ends.
 *
 * The argument that used to justify the success-only form was that cleanup was
 * distributed — the operation chains' catch blocks also restored the session.
 * This release unwound those chains, so that layer is gone and nothing
 * downstream restores anything.
 *
 * `finally`, not `catch`: the error propagates untouched. This changes what the
 * session is after a failure and nothing else.
 */
export async function inStatefulSession<T>(
  connection: SessionSwitchable,
  run: () => Promise<T>,
): Promise<T> {
  connection.setSessionType?.('stateful');
  try {
    return await run();
  } finally {
    connection.setSessionType?.('stateless');
  }
}
