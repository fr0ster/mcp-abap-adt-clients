/**
 * Client-side session invariants — no SAP system involved.
 *
 * A stateful ADT session is killed by what WE send, before SAP is even
 * consulted: a request that leaves without the stateful marker while a lock is
 * held. These tests pin that behaviour on the real handler chains, so a change
 * in either adt-clients or the connector shows up as a red test rather than as
 * an "object is locked and inactive" incident on a live system.
 *
 * Run without SAP credentials:
 *   npx jest src/__tests__/unit/session
 */

import { AdtClass } from '../../../core/class/AdtClass';
import { AdtDomain } from '../../../core/domain/AdtDomain';
import { LockRegistry } from '../../../core/shared/LockRegistry';
import { noopLogger } from '../../../utils/noopLogger';
import { createSessionRecorder } from './sessionRecorder';

// These tests talk to a local stub and finish in well under a second. The suite
// default is 15 minutes, meant for integration runs — long enough that anything
// stuck here reads as a hang rather than a failure, with no test named and no
// stack. A tight ceiling turns that into an ordinary timeout that says which
// test and where.
jest.setTimeout(20_000);

const SOURCE = 'CLASS zcl_a DEFINITION PUBLIC. ENDCLASS.';

describe('session invariants — single handler', () => {
  /**
   * DELIBERATE DIVERGENCE FROM ECLIPSE.
   *
   * Eclipse sends `x-sap-adt-sessiontype: stateful` on LOCK and UNLOCK only —
   * not even on the lock-bound PUT in between. We mark the whole window because
   * of commit 50c9310 (#38, refs mcp-abap-adt#106): on older kernels (BASIS
   * 7.55) a stateless lock-bound write failed with 423 "not locked (invalid
   * lock handle)", while newer kernels (758/816) tolerated it.
   *
   * So this is compatibility, not protocol ignorance. Narrowing the window to
   * Eclipse's form would reintroduce #38 on 7.55-class systems — do it only
   * with evidence from that kernel class, not from a modern one.
   */
  it('issues every request of the update chain inside the lock window as stateful', async () => {
    const rec = createSessionRecorder();
    const cls = new AdtClass(rec.conn, noopLogger);

    await cls.update({ className: 'ZCL_A', sourceCode: SOURCE });

    const window = rec.lockWindow();
    expect(window.length).toBeGreaterThan(1);
    expect(window[0].url).toContain('_action=LOCK');
    expect(window[window.length - 1].url).toContain('_action=UNLOCK');

    const stateless = window.filter((c) => c.mode !== 'stateful');
    expect(
      stateless.map((c) => `${c.method} ${c.url} [${c.mode}]`),
    ).toStrictEqual([]);
  });

  it('leaves the session stateless once the chain has unlocked', async () => {
    const rec = createSessionRecorder();
    const cls = new AdtClass(rec.conn, noopLogger);

    await cls.update({ className: 'ZCL_A', sourceCode: SOURCE });

    expect(rec.mode).toBe('stateless');
  });

  it('reads (GET) inside the lock window — the surface where a 401 or a timeout costs the lock', async () => {
    const rec = createSessionRecorder();
    const cls = new AdtClass(rec.conn, noopLogger);

    await cls.update({ className: 'ZCL_A', sourceCode: SOURCE });

    // A GET between UPDATE and UNLOCK is what turns a transient auth error or a
    // per-request timeout into a lost lock: the connector reacts by re-fetching
    // a CSRF token (a request without the stateful marker) or by tearing down
    // the socket. Both happen while the lock is still held.
    const getsInWindow = rec
      .lockWindow()
      .filter((c) => c.method === 'GET' && !c.url.includes('_action='));
    expect(getsInWindow.length).toBeGreaterThan(0);
  });
});

describe('session invariants — domain (the shape seen in the E19 incident)', () => {
  /**
   * The E19 "Session not found" log shows create 201 → LOCK 200 → GET 400: a
   * GET immediately after LOCK, with no write in between. That GET is ours —
   * updateDomain is a read-modify-write (`src/core/domain/update.ts:4`), so it
   * reads the current XML while the lock is already held. This test pins that
   * shape: it is the first request of the lock window that can hit a session
   * which SAP has already dropped, and it is the exact request that failed.
   */
  it('emits the lock window as LOCK → GET → PUT → GET → UNLOCK, every request stateful', async () => {
    const rec = createSessionRecorder();
    const domain = new AdtDomain(rec.conn, noopLogger);

    await domain.update({
      domainName: 'ZOK_D_CS_553',
      packageName: '$TMP',
      description: 'probe',
      datatype: 'CHAR',
      length: 10,
    });

    const window = rec.lockWindow();
    expect(window.map((c) => c.method)).toStrictEqual([
      'POST', // LOCK
      'GET', // read-modify-write: read current XML, lock already held
      'PUT', // write the patched XML
      'GET', // read-back with long polling
      'POST', // UNLOCK
    ]);
    expect(window.every((c) => c.mode === 'stateful')).toBe(true);

    // The read-modify-write GET sits directly behind LOCK, before any write.
    // That is the request that returned 400 "Session not found" on E19 — the
    // first place a session dropped between LOCK and the next call shows up.
    expect(window[0].url).toContain('_action=LOCK');
    expect(window[1].method).toBe('GET');
  });

  /**
   * DEFECT CHARACTERISATION.
   *
   * A GET straight after LOCK is normal ADT behaviour — Eclipse does it too,
   * but Eclipse reads the INACTIVE version. Ours asks for no version at all
   * (`getDomain` builds the URL without a `version` parameter, and
   * `AdtDomain.read` ignores its `_version` argument outright), so the
   * read-modify-write patches whatever the ACTIVE version holds. After a create
   * that left the object inactive, that reads the wrong source for the patch.
   *
   * Compare with the class chain, which does pass `version=inactive`.
   */
  it('reads no version at all after LOCK, where Eclipse reads the inactive one', async () => {
    const rec = createSessionRecorder();
    const domain = new AdtDomain(rec.conn, noopLogger);

    await domain.update({
      domainName: 'ZOK_D_CS_553',
      packageName: '$TMP',
      description: 'probe',
      datatype: 'CHAR',
      length: 10,
    });

    const readModifyWriteGet = rec.lockWindow()[1];
    expect(readModifyWriteGet.method).toBe('GET');
    expect(readModifyWriteGet.url).not.toContain('version=');
  });
});

describe('session invariants — two handlers on one connection', () => {
  /**
   * DEFECT CHARACTERISATION (not desired behaviour).
   *
   * Handlers created from one AdtClient share a single IAbapConnection and a
   * single session mode. A chain that finishes on handler B unconditionally
   * restores 'stateless' — it has no way to know handler A still holds a lock.
   * The next write for A therefore leaves the client without the stateful
   * marker, which is exactly the 423 / "session does not exist" scenario.
   *
   * When this is fixed (lock-aware session control), flip the expectations:
   * the PUT below must go out 'stateful' and rec.mode must stay 'stateful'
   * while registry.pending is non-empty.
   */
  it('a chain finishing on handler B resets the session while handler A holds a lock', async () => {
    const rec = createSessionRecorder();
    const registry = new LockRegistry(rec.conn);
    const clsA = new AdtClass(
      rec.conn,
      noopLogger,
      undefined,
      undefined,
      registry,
    );
    const clsB = new AdtClass(
      rec.conn,
      noopLogger,
      undefined,
      undefined,
      registry,
    );

    const handleA = await clsA.lock({ className: 'ZCL_A' });
    expect(rec.mode).toBe('stateful');
    expect(registry.pending).toStrictEqual(['Class/ZCL_A']);

    await clsB.update({ className: 'ZCL_B', sourceCode: SOURCE });

    // A's lock is still held...
    expect(registry.pending).toStrictEqual(['Class/ZCL_A']);
    // ...but B's chain has already put the shared session back to stateless.
    expect(rec.mode).toBe('stateless');

    const before = rec.calls.length;
    await clsA.update(
      { className: 'ZCL_A', sourceCode: SOURCE },
      { lockHandle: handleA },
    );

    const writeForA = rec.calls
      .slice(before)
      .find((c) => c.method === 'PUT' && c.url.includes('zcl_a'));
    expect(writeForA).toBeDefined();
    // The defect, machine-checked: a write for a locked object left the client
    // without the stateful marker.
    expect(writeForA?.mode).toBe('stateless');
  });

  it('unlockAll releases the whole batch inside one stateful window', async () => {
    const rec = createSessionRecorder();
    const registry = new LockRegistry(rec.conn);
    const clsA = new AdtClass(
      rec.conn,
      noopLogger,
      undefined,
      undefined,
      registry,
    );
    const clsB = new AdtClass(
      rec.conn,
      noopLogger,
      undefined,
      undefined,
      registry,
    );

    await clsA.lock({ className: 'ZCL_A' });
    await clsB.lock({ className: 'ZCL_B' });

    const before = rec.calls.length;
    const failures = await registry.unlockAll();

    expect(failures).toStrictEqual([]);
    const unlocks = rec.calls
      .slice(before)
      .filter((c) => c.url.includes('_action=UNLOCK'));
    expect(unlocks).toHaveLength(2);
    expect(unlocks.every((c) => c.mode === 'stateful')).toBe(true);
    expect(rec.mode).toBe('stateless');
    expect(registry.pending).toStrictEqual([]);
  });
});
