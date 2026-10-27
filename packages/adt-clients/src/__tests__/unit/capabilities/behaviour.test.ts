/**
 * Check 3 — every capability a handler claims does what that capability means.
 *
 * Types are not enough here, and the two failures this catches are the two the
 * plan exists for:
 *
 * - a method that **carries** an atom and refuses when called. That is a stub,
 *   and the shape check cannot see it: a class with a throwing `getVersions`
 *   satisfies `IAdtVersionable` perfectly.
 * - a method that issues **no request at all** and returns an empty state,
 *   which reads to a caller as success. `unitTest.validate` and
 *   `transport.validate` both did exactly that.
 *
 * So each claimed capability is called against a recording connection, and the
 * assertion is that a request went out. Every method of every atom, not one per
 * atom — `readMetadata`, `unlock` and `getVersionSource` are where stubs hid.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { createLibraryLogger } from '../../helpers/testLogger';
import {
  ACTIVATION_OK,
  assertIssuesItsRequest,
  bodyFor,
  invoke,
  invokeWithOptions,
  type Recorded,
  recordingClient,
  takesOptions,
  wireUrl,
} from './behaviourGuard';
import {
  ATOM_METHODS,
  type Atom,
  HANDLERS,
  type HandlerEntry,
} from './manifest';

/**
 * Nobody builds a session type into a request.
 *
 * `x-sap-adt-sessiontype` is the connection's, written by the connection from
 * its own mode. Five low-level functions used to put it in the headers
 * themselves — `featureToggle`'s lock, unlock, update and source write, and
 * `functionInclude`'s source write — and the guard below could not see it,
 * because that guard asks who calls `setSessionType` and these called nobody.
 *
 * The cost was not a duplicate header. The connection's own mode was stateless
 * while the request said stateful, so a write ran inside a session the
 * connection did not know it was in — and what the server takes during such a
 * request is held by that session, long after the object is gone.
 */
describe('the session type is the connection’s, never a request’s', () => {
  it('no member puts x-sap-adt-sessiontype in its headers', async () => {
    const offenders: string[] = [];

    for (const [name, entry] of Object.entries(HANDLERS)) {
      for (const atom of Object.keys(ATOM_METHODS) as Atom[]) {
        for (const method of ATOM_METHODS[atom]) {
          const { client, calls } = recordingClient();
          const handler = entry.factory(client) as unknown as Record<
            string,
            unknown
          >;
          if (typeof handler[method] !== 'function') continue;
          try {
            await invoke(
              handler,
              method,
              entry.config as Record<string, unknown>,
            );
          } catch {
            // A member that refuses is fine here; what it sent is the subject.
          }
          for (const call of calls) {
            const hit = Object.keys(call.headers ?? {}).find(
              (h) => h.toLowerCase() === 'x-sap-adt-sessiontype',
            );
            if (hit) offenders.push(`${name}.${method} → ${call.url} [${hit}]`);
          }
        }
      }
    }

    expect(offenders).toStrictEqual([]);
  });
});

describe('capability guard — behaviour', () => {
  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    describe(name, () => {
      for (const atom of entry.capabilities) {
        for (const method of ATOM_METHODS[atom as Atom]) {
          it(`${atom}: ${method} issues a request`, async () => {
            const { client, calls } = recordingClient();
            const handler = entry.factory(client) as unknown as Record<
              string,
              unknown
            >;

            expect(typeof handler[method]).toBe('function');

            let refusal: unknown;
            try {
              await invoke(handler, method, entry.config);
            } catch (error) {
              refusal = error;
            }

            assertIssuesItsRequest(name, entry, method, calls, refusal);
          });
        }
      }
    });
  }
});

/**
 * A member does not touch the session.
 *
 * Statefulness belongs to the lock window, and since 18.0.0 a lock window is
 * something the consumer opens: it calls `lock`, then the write, then `unlock`,
 * and it is the one that knows whether those three belong to the same session.
 * A member that flipped the connection to stateful and back would take that
 * decision away — and worse, would reset it under a *different* handler that
 * happens to hold a lock on the same connection. That was the the on-premise system incident, and
 * this is the assertion that keeps its cause from coming back.
 *
 * `lock` and `unlock` are exempt on purpose: they are the session, not a
 * request that happens inside one.
 */
describe('capability guard — a member leaves the session alone', () => {
  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    for (const atom of entry.capabilities) {
      for (const method of ATOM_METHODS[atom as Atom]) {
        if (method === 'lock' || method === 'unlock') continue;
        // The one exception in the library, and it is named rather than
        // skipped: a message is a row inside its class's document, so writing
        // one takes two lock handles and a read-modify-write of XML this
        // library assembles. Its session handling is the write's own.
        const exempt =
          name === 'messageClassMessage' &&
          (method === 'create' || method === 'update' || method === 'delete');
        it(`${name}.${method} ${exempt ? 'owns its session window' : 'never calls setSessionType'}`, async () => {
          const { client, sessionTypes } = recordingClient();
          const handler = entry.factory(client) as unknown as Record<
            string,
            unknown
          >;
          try {
            await invoke(handler, method, entry.config);
          } catch {
            // What the member answered is another test's subject. Even a
            // refusal must not have moved the session on its way out.
          }
          if (exempt) {
            expect(sessionTypes.length).toBeGreaterThan(0);
            expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
            return;
          }
          expect(sessionTypes).toEqual([]);
        });
      }
    }
  }
});

/**
 * A lock window that fails still puts the session back.
 *
 * The guard above asks that ordinary members never touch `setSessionType`.
 * `lock` and `unlock` are exempt there — they *are* the session — and that
 * exemption is exactly where the defect lived: all three methods of
 * `LockCapability`, and the same pattern hand-written in twenty-six handlers,
 * set stateful, ran the request, and set stateless **as the last statement of
 * the success path**. A refused `LOCK` — an object someone else holds, an
 * expired session, a dropped connection — jumped over the restore.
 *
 * The connection is shared, so the cost is not confined to the caller that
 * failed: the next unrelated request goes out inside a session nobody asked
 * for, and what the server takes during it is held until that session ends.
 *
 * This asserts the invariant rather than the implementation, so it holds for
 * whichever way a handler spells its cleanup — `inStatefulSession`, a bare
 * `finally`, or `chain`'s `onScopeEnd`.
 */
describe('capability guard — a failed lock window restores the session', () => {
  /** Every request is refused, which is the whole point. */
  function refusingClient() {
    const sessionTypes: string[] = [];
    const connection = {
      connect: async () => {},
      getBaseUrl: async () => 'https://example',
      getSessionId: () => null,
      setSessionType: (type: string) => {
        sessionTypes.push(type);
      },
      makeAdtRequest: async () => {
        throw new Error('guard: the server refused this request');
      },
    } as unknown as IAbapConnection;
    const client = new AdtClient(connection, createLibraryLogger());
    return { client, sessionTypes };
  }

  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    if (!entry.capabilities.includes('lockable')) continue;
    for (const method of ['lock', 'unlock']) {
      it(`${name}.${method} leaves the session stateless when the request fails`, async () => {
        const { client, sessionTypes } = refusingClient();
        const handler = entry.factory(client) as unknown as Record<
          string,
          unknown
        >;
        try {
          await invoke(handler, method, entry.config);
        } catch {
          // Whether the refusal arrives as an answer or a throw is another
          // test's subject. Either way the session must be back.
        }

        // The invariant is "never left stateful", and only that. A member that
        // switched nothing asked the server nothing, or was refused before the
        // wire; a member that only ever sets stateless is making a different
        // choice, right or wrong, and this guard is not about that choice. What
        // must not happen is going stateful and stopping there.
        if (!sessionTypes.includes('stateful')) return;
        expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
      });
    }
  }
});

/**
 * The LOCK and the UNLOCK go out stateful — they alone, and each on its own.
 *
 * The lock lives in the stateful ABAP context the `LOCK` opened, and only a
 * request that reaches that context can release it. The connector decides
 * which requests carry the context cookie by the session mode at the moment
 * of the request: since `@mcp-abap-adt/connection` 9.3.1 a stateless request
 * goes without it, so a stateless `UNLOCK` runs in a fresh context, answers
 * 200, and releases nothing. Measured on premise (BASIS 816), 2026-09-27: twenty-four unlocks
 * here were sent stateless — `lock` went back to stateless as soon as its own
 * request answered — and the include suite's activation then answered 403
 * `EU/510` "currently editing", with its cleanup delete refused the same way.
 * The older connector sent the cookie on every request, which hid it.
 *
 * So both requests are stamped with the mode they left in, and the session is
 * stateless again once each member returns: everything between them — the
 * write included — goes stateless, as Eclipse sends it.
 */
describe('capability guard — LOCK and UNLOCK are the stateful requests', () => {
  function modeRecordingClient() {
    let mode = 'stateless';
    const sent: Array<{ url: string; mode: string }> = [];
    const connection = {
      connect: async () => {},
      getBaseUrl: async () => 'https://example',
      getSessionId: () => null,
      setSessionType: (type: string) => {
        mode = type;
      },
      makeAdtRequest: async (req: Recorded) => {
        sent.push({ url: wireUrl(req), mode });
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: bodyFor(req.url, ACTIVATION_OK),
        } as IAdtWireResponse;
      },
    } as unknown as IAbapConnection;
    const client = new AdtClient(connection, createLibraryLogger());
    return { client, sent, mode: () => mode };
  }

  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    if (!entry.capabilities.includes('lockable')) continue;
    for (const [method, action] of [
      ['lock', 'LOCK'],
      ['unlock', 'UNLOCK'],
    ] as const) {
      it(`${name}.${method} sends its ${action} stateful and returns stateless`, async () => {
        const { client, sent, mode } = modeRecordingClient();
        const handler = entry.factory(client) as unknown as Record<
          string,
          unknown
        >;
        await invoke(handler, method, entry.config);

        const own = sent.filter((r) => r.url.includes(`_action=${action}`));
        expect(own.length).toBeGreaterThan(0);
        expect(own.map((r) => r.mode)).toEqual(own.map(() => 'stateful'));
        expect(mode()).toBe('stateless');
      });
    }
  }
});

/**
 * The caller's deadline reaches the wire.
 *
 * This library sends no client-side deadline of its own — every request
 * carries `timeout: 0` — and `IAdtOperationOptions.timeout` is how a caller
 * asks for one. The low-level functions cannot see that option, so a member
 * wraps its connection (`withCallTimeout`) and every request below carries it.
 *
 * This asserts the promise rather than the mechanism: whatever a member does
 * internally, a request it issues carries the number the caller passed.
 */
describe('capability guard — options.timeout reaches the wire', () => {
  const DEADLINE = 4321;

  for (const [name, entry] of Object.entries(
    HANDLERS as Record<string, HandlerEntry>,
  )) {
    for (const atom of entry.capabilities) {
      for (const method of ATOM_METHODS[atom as Atom]) {
        // `lock` and `unlock` take no options bag — the lock window's shape is
        // the caller's own sequence, and neither member has one to read.
        if (method === 'lock' || method === 'unlock') continue;

        it(`${name}.${method} carries the caller's timeout`, async () => {
          const { client, calls } = recordingClient();
          const handler = entry.factory(client) as unknown as Record<
            string,
            unknown
          >;
          // A member with no options parameter promises nothing per call.
          if (!takesOptions(handler, method)) return;
          try {
            await invokeWithOptions(handler, method, entry.config, {
              timeout: DEADLINE,
            });
          } catch {
            // A member that refuses before the wire issued no request, and the
            // check below is about requests that were issued.
          }

          const issued = calls.filter((c) => c.timeout !== undefined);
          if (calls.length === 0) return;
          expect(issued.map((c) => c.timeout)).toEqual(
            calls.map(() => DEADLINE),
          );
        });
      }
    }
  }
});
