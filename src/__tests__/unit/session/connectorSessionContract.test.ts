/**
 * Connector session contract — verified against the REAL connection package.
 *
 * What is established about the wire protocol:
 *  - `x-sap-adt-sessiontype: stateful` is a per-request instruction ("handle
 *    this one in a stateful session"). Eclipse sends it on LOCK/UNLOCK only;
 *    every other call carries just the session cookie, and the lock survives.
 *  - This connector never sends the header with value `stateless` — outside a
 *    stateful window it simply omits it, which is wire-identical to an ordinary
 *    Eclipse call. Omission is therefore NOT what closes a session.
 *  - Session membership rides on the cookie (`sap-contextid` / SAP_SESSIONID),
 *    with `sap-adt-connection-id` identifying the conversation.
 *
 * What these tests pin: the connector's own housekeeping requests (CSRF fetch,
 * retry probes) are built by a separate code path that consults neither the
 * session mode nor the connection id. That path is where a token refetch can
 * silently start a NEW session — the failure mode worth guarding, distinct
 * from the header question above.
 *
 * Local HTTP stub — no SAP, no credentials:
 *   MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/session
 */

import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { ISapConfig } from '@mcp-abap-adt/interfaces';
import { type AdtStub, startAdtStub } from './adtStubServer';

const configFor = (baseUrl: string): ISapConfig => ({
  url: baseUrl,
  client: '100',
  authType: 'basic',
  username: 'STUB',
  password: 'STUB',
});

describe('connector session contract (real @mcp-abap-adt/connection)', () => {
  let stub: AdtStub;

  beforeEach(async () => {
    stub = await startAdtStub();
  });

  afterEach(async () => {
    await stub.close();
  });

  it('marks ordinary requests stateful once the session is armed', async () => {
    const conn = createAbapConnection(configFor(stub.baseUrl), null);
    conn.setSessionType('stateful');

    await conn.makeAdtRequest({
      url: '/sap/bc/adt/ddic/domains/zstub?_action=LOCK&accessMode=MODIFY',
      method: 'POST',
      timeout: 5000,
      data: null,
    });

    const lock = stub.matching('_action=LOCK');
    expect(lock).toHaveLength(1);
    expect(lock[0].stateful).toBe(true);
  });

  /**
   * REGRESSION SHIELD — connection@1.10.1, issue #14.
   *
   * The CSRF fetch used to assemble its own headers and omit
   * `sap-adt-connection-id`, so a fetch triggered while a lock was held reached
   * the server as a caller unrelated to the conversation that opened the
   * session. It now carries the id like every other request.
   *
   * The session-type marker is deliberately still absent: Eclipse sends
   * `x-sap-adt-sessiontype` on LOCK/UNLOCK only — not even on the lock-bound
   * PUT between them — so putting it on a housekeeping GET has no established
   * benefit. That asymmetry is intended, not an oversight.
   */
  it('sends the CSRF fetch inside the conversation, with the connection id', async () => {
    const conn = createAbapConnection(configFor(stub.baseUrl), null);
    conn.setSessionType('stateful');

    // A mutation with no cached token forces the connector to fetch one first.
    await conn.makeAdtRequest({
      url: '/sap/bc/adt/ddic/domains/zstub?_action=LOCK&accessMode=MODIFY',
      method: 'POST',
      timeout: 5000,
      data: null,
    });

    const csrfFetches = stub
      .matching('/discovery')
      .filter((r) => r.headers['x-csrf-token'] === 'fetch');
    expect(csrfFetches.length).toBeGreaterThan(0);

    for (const fetch of csrfFetches) {
      expect(fetch.headers['sap-adt-connection-id']).toBe(conn.getSessionId());
      expect(fetch.stateful).toBe(false); // intended, see above
    }
  });

  it('uses one connection id for the whole connector lifetime, including across reset()', async () => {
    const conn = createAbapConnection(configFor(stub.baseUrl), null);
    conn.setSessionType('stateful');

    await conn.makeAdtRequest({
      url: '/sap/bc/adt/ddic/domains/zstub?_action=LOCK&accessMode=MODIFY',
      method: 'POST',
      timeout: 5000,
      data: null,
    });
    // reset() drops the token, cookies and the axios instance — but the
    // connection id must survive, otherwise every recovery would present the
    // server with a different conversation.
    (conn as unknown as { reset: () => void }).reset();
    await conn.makeAdtRequest({
      url: '/sap/bc/adt/ddic/domains/zstub',
      method: 'GET',
      timeout: 5000,
    });

    const ids = stub.requests
      .map((r) => r.headers['sap-adt-connection-id'])
      .filter(Boolean);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(conn.getSessionId());
  });

  /**
   * FORMAT NOTE (not a proven defect).
   *
   * Eclipse's connection id is 32 hex characters with no dashes
   * (e.g. 26df8f6f97684b94a2d37044db28ea25). The connector already strips the
   * dashes for `sap-adt-request-id` (`randomUUID().replace(/-/g, '')`) but not
   * for `sap-adt-connection-id`, so ours goes out in dashed UUID form. Nothing
   * observed says the server rejects it — this pins the difference so it is a
   * decision rather than an accident.
   */
  it('sends the connection id as a dashed UUID, unlike the dashless Eclipse form', async () => {
    const conn = createAbapConnection(configFor(stub.baseUrl), null);
    conn.setSessionType('stateful');

    await conn.makeAdtRequest({
      url: '/sap/bc/adt/ddic/domains/zstub?_action=LOCK&accessMode=MODIFY',
      method: 'POST',
      timeout: 5000,
      data: null,
    });

    const locked = stub.matching('_action=LOCK')[0];
    expect(locked.headers['sap-adt-connection-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    // Eclipse form for comparison: 32 hex chars, no dashes.
    expect(locked.headers['sap-adt-request-id']).toMatch(/^[0-9a-f]{32}$/);
  });

  /**
   * DEFECT — lifecycle. A connector should hold its session from connect() and
   * refuse to work after it is torn down, so that a caller can never operate on
   * a session it did not open.
   *
   * Neither half holds today:
   *  - `connect()` is optional. A request on a never-connected connector opens
   *    a session on the fly, so "connected" is not a state the caller controls.
   *  - There is no `disconnect()` on the HTTP connections at all (only RFC has
   *    close()). `reset()` tears the session down, and the very next request
   *    silently opens a NEW one under the SAME connection id — the caller keeps
   *    believing it holds the lock it acquired in the previous session.
   */
  it('opens a session without connect(), and silently opens another after reset()', async () => {
    const conn = createAbapConnection(configFor(stub.baseUrl), null);
    conn.setSessionType('stateful');

    // No connect() call anywhere — yet the mutation goes through.
    await conn.makeAdtRequest({
      url: '/sap/bc/adt/ddic/domains/zstub?_action=LOCK&accessMode=MODIFY',
      method: 'POST',
      timeout: 5000,
      data: null,
    });
    expect(stub.sessionsOpened()).toBe(1);
    const lockCookie = stub.matching('_action=LOCK')[0].headers.cookie;

    (conn as unknown as { reset: () => void }).reset();

    // A teardown does not stop the connector: the next mutation quietly opens a
    // second session. Nothing throws, nothing tells the caller.
    await conn.makeAdtRequest({
      url: '/sap/bc/adt/ddic/domains/zstub/source/main?lockHandle=LH-1',
      method: 'PUT',
      timeout: 5000,
      data: 'x',
    });
    expect(stub.sessionsOpened()).toBe(2);

    const write = stub.matching('/source/main')[0];
    expect(write.headers.cookie).not.toBe(lockCookie);
    // Same conversation id, different session — indistinguishable to the caller.
    expect(write.headers['sap-adt-connection-id']).toBe(conn.getSessionId());
  });

  it('keeps the mid-window recovery fetch after a 403 inside the conversation', async () => {
    const conn = createAbapConnection(configFor(stub.baseUrl), null);
    conn.setSessionType('stateful');

    // Arm the session and cache a token.
    await conn.makeAdtRequest({
      url: '/sap/bc/adt/ddic/domains/zstub?_action=LOCK&accessMode=MODIFY',
      method: 'POST',
      timeout: 5000,
      data: null,
    });
    const beforeRetry = stub.requests.length;

    // A CSRF rejection on the in-window write sends the connector back for a
    // fresh token. That recovery request is the one most likely to land while a
    // lock is held, so it must present the same conversation id.
    stub.failNext('/source/main', 403);
    await conn.makeAdtRequest({
      url: '/sap/bc/adt/ddic/domains/zstub/source/main?lockHandle=LH-1',
      method: 'PUT',
      timeout: 5000,
      data: 'x',
    });

    const duringRecovery = stub.requests.slice(beforeRetry);
    const recoveryFetches = duringRecovery.filter(
      (r) => r.headers['x-csrf-token'] === 'fetch',
    );
    expect(recoveryFetches.length).toBeGreaterThan(0);
    expect(
      recoveryFetches.every(
        (r) => r.headers['sap-adt-connection-id'] === conn.getSessionId(),
      ),
    ).toBe(true);
  });
});
