/**
 * Timeout utilities for ADT clients
 *
 * Provides timeout configuration similar to connection package
 * but without dependency on connection package
 */

import type { ITimeoutConfig } from '@mcp-abap-adt/interfaces';

/**
 * Get timeout configuration from environment variables
 *
 * **The default is no client-side deadline (`0`, which every HTTP client here
 * reads as "do not abort"), and `SAP_TIMEOUT_DEFAULT` is how an operator asks
 * for one.** It used to be 45 000 ms on every request this library makes — 436
 * of them — and aborting a request the server is still executing costs more
 * than it saves.
 *
 * Measured on one system: `POST /deletion/delete` was aborted at 45 s, the
 * retry was answered `400 … Session Timed Out or Not Found` with a **new**
 * session cookie, and everything afterwards ran in a session nobody asked for.
 * Of 794 responses in that run, 30 carried `set-cookie`: 29 were `_action=LOCK`
 * binding a stateful session, and the 30th was that error.
 *
 * The cost of the abort is not the failed request. Over HTTP a session is two
 * layers — the ICF one the cookie addresses, and the ABAP one underneath that
 * holds the enqueue locks. The abort replaces the first and strands the second:
 * the lock handle is dead, the lock is not, and nothing can reach it any more.
 * That is measured elsewhere in this repository as "a session recycle does not
 * clear it; only the unlock does". RFC has no such split — one ABAP session for
 * the connection's lifetime — which is why it never shows this.
 *
 * A caller who wants a deadline still has one: `IAdtOperationOptions.timeout`,
 * and `SAP_TIMEOUT_DEFAULT` for a system-wide floor. What is gone is this
 * library deciding it for them, which is the same rule it follows for the lock
 * window and the operation sequence.
 */
export function getTimeoutConfig(): ITimeoutConfig {
  const defaultTimeout = parseInt(process.env.SAP_TIMEOUT_DEFAULT || '0', 10);
  const csrfTimeout = parseInt(process.env.SAP_TIMEOUT_CSRF || '15000', 10);
  const longTimeout = parseInt(process.env.SAP_TIMEOUT_LONG || '120000', 10);

  return {
    default: defaultTimeout,
    csrf: csrfTimeout,
    long: longTimeout,
  };
}

/**
 * Get timeout value by type or number
 * @param type - Timeout type ("default", "csrf", "long") or number
 * @returns Timeout value in milliseconds
 */
export function getTimeout(
  type: 'default' | 'csrf' | 'long' | number = 'default',
): number {
  if (typeof type === 'number') {
    return type;
  }

  const config = getTimeoutConfig();
  return config[type];
}
