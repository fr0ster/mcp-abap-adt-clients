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
 *  - The HTTP session (cookies) and the ABAP session on the server are different
 *    things: `SAP_SESSIONID_<SID>_<CLNT>` is the cookie that carries the stateful
 *    ABAP session, while `sap-adt-connection-id` identifies the conversation. A
 *    live cookie is not proof of a live ABAP session — E19 answered 400 "Session
 *    not found" with the cookie present.
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
import { ADT_SESSION_ERROR, type ISapConfig } from '@mcp-abap-adt/interfaces';
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
    await conn.connect();
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
    await conn.connect();
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
    await conn.connect();
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
    // Reconnecting is required since 2.0.0, and is the point of the assertion
    // below: a NEW session under the SAME conversation id. Previously the next
    // request did this silently, which is what made a replacement invisible.
    await conn.connect();
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
    await conn.connect();
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
   * FIXED in @mcp-abap-adt/connection 2.0.0. This test used to document the
   * defect; it now pins the fix, and is kept rather than deleted because the
   * defect is what the whole design exists to prevent.
   *
   * What it was: `connect()` was optional, so a request on a never-connected
   * connector opened a session on the fly — "connected" was not a state the
   * caller controlled. And `reset()` tore the session down while the next
   * request silently opened a NEW one under the SAME connection id, so a caller
   * went on believing it held a lock acquired in a session that no longer
   * existed.
   *
   * Connecting remains the CONSUMER's job — this library must not connect on
   * anyone's behalf. What changed is that failing to do so is now refused
   * loudly, before anything reaches the server, instead of being papered over.
   */
  it('refuses a request without connect(), and again after reset()', async () => {
    const conn = createAbapConnection(configFor(stub.baseUrl), null);
    conn.setSessionType('stateful');

    const lock = {
      url: '/sap/bc/adt/ddic/domains/zstub?_action=LOCK&accessMode=MODIFY',
      method: 'POST' as const,
      timeout: 5000,
      data: null,
    };

    // No connect(): refused, and — the part that matters — nothing is sent. An
    // error after the LOCK landed would still have left a lock on the server.
    await expect(conn.makeAdtRequest(lock)).rejects.toMatchObject({
      code: ADT_SESSION_ERROR.NOT_CONNECTED,
    });
    expect(stub.sessionsOpened()).toBe(0);
    expect(stub.requests).toHaveLength(0);

    await conn.connect();
    await conn.makeAdtRequest(lock);
    expect(stub.sessionsOpened()).toBe(1);

    (conn as unknown as { reset: () => void }).reset();

    // A teardown now stops the connector. Previously this quietly opened a
    // second session and told the caller nothing.
    await expect(
      conn.makeAdtRequest({
        url: '/sap/bc/adt/ddic/domains/zstub/source/main?lockHandle=LH-1',
        method: 'PUT',
        timeout: 5000,
        data: 'x',
      }),
    ).rejects.toMatchObject({ code: ADT_SESSION_ERROR.NOT_CONNECTED });
    expect(stub.sessionsOpened()).toBe(1);
  });

  it('keeps the mid-window recovery fetch after a 403 inside the conversation', async () => {
    const conn = createAbapConnection(configFor(stub.baseUrl), null);
    await conn.connect();
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
