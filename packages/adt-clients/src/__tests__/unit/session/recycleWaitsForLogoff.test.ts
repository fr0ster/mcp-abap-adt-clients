/**
 * A recycled session's replacement opens only after SAP answered the logoff.
 *
 * `disconnect()` (connection 16) resolves when the logoff is WRITTEN, not
 * answered, and SAP may hold the old session — and its locks — until it
 * answers. `recycleTestSession` promises never to open a second session beside
 * the first, so it waits for the answer (`flushGoodbye()`) before it builds the
 * replacement. The stub holds the logoff's answer to make the gap visible.
 *
 * Local HTTP stub — no SAP, no credentials.
 */

import { BasicAuthProvider } from '@mcp-abap-adt/auth-providers';
import {
  AdtOnPremConnector,
  OnPremHttpTransport,
} from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { recycleTestSession } from '../../helpers/sessionConfig';
import type { ISessionSharing } from '../../helpers/sharedSession';
import { type AdtStub, startAdtStub } from './adtStubServer';

// A live run's globalSetup publishes its session to the shared file. Read
// through, this stub run would take that file for its own and publish the
// stub's session over the live run's; it is cut off from the file instead.
jest.mock('../../helpers/sharedSession', () => ({
  ...jest.requireActual('../../helpers/sharedSession'),
  readSessionMaterial: () => null,
  publishSessionMaterial: jest.fn(),
}));

jest.setTimeout(20_000);

const LOGOFF = '/sap/public/bc/icf/logoff';

describe('recycleTestSession waits for the logoff to be answered', () => {
  let stub: AdtStub;

  beforeEach(async () => {
    stub = await startAdtStub();
  });

  afterEach(async () => {
    await stub.close();
  });

  it('builds the replacement only after SAP answered the old session’s logoff', async () => {
    const conn = new AdtOnPremConnector(
      { url: stub.baseUrl, client: '100', authType: 'basic' },
      new BasicAuthProvider('STUB', 'STUB'),
      new OnPremHttpTransport(() => ({}), null, {
        client: '100',
        baseUrl: stub.baseUrl,
      }),
      null,
    );
    await conn.connect();

    let answered = false;
    const releaseLogoff = stub.holdNext(LOGOFF);
    const replacement = {} as IAbapConnection &
      ISessionLifecycleAware &
      ISessionSharing;
    let builtWhileUnanswered: boolean | undefined;
    const open = jest.fn(async () => {
      builtWhileUnanswered = !answered;
      return replacement;
    });

    const recycled = recycleTestSession(conn, open);

    // Wait until the logoff reached the stub; it is held there, unanswered.
    while (stub.matching(LOGOFF).length === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    // Give a recycle that did not wait every chance to build the replacement.
    for (let i = 0; i < 50; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(open).not.toHaveBeenCalled();

    answered = true;
    releaseLogoff();
    await expect(recycled).resolves.toBe(replacement);
    expect(open).toHaveBeenCalledTimes(1);
    expect(builtWhileUnanswered).toBe(false);
  });
});
