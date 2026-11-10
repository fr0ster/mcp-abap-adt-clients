/**
 * The cause of a connection failure, from the real connector on a real socket.
 *
 * The REAL `@mcp-abap-adt/connection` connects to a local stub, the stub goes
 * away, and a member's request finds nothing listening on the port: the
 * connection was made, the request has no answer. Measured before this case
 * was written (2026-11-10): the connector rejects with the transport's own
 * error, its own `code` `ECONNREFUSED`, and until interfaces-adt 27.1.0 the
 * failure kept only its message.
 *
 * Local HTTP stub — no SAP, no credentials.
 */

import { BasicAuthProvider } from '@mcp-abap-adt/auth-providers';
import {
  AdtOnPremConnector,
  OnPremHttpTransport,
} from '@mcp-abap-adt/connection';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { noopLogger } from '../../../utils/noopLogger';
import { startAdtStub } from './adtStubServer';

// A live run's globalSetup publishes its session to the shared file; this stub
// run is cut off from it, as in the other stub suites.
jest.mock('../../helpers/sharedSession', () => ({
  ...jest.requireActual('../../helpers/sharedSession'),
  readSessionMaterial: () => null,
  publishSessionMaterial: jest.fn(),
}));

jest.setTimeout(20_000);

describe('a request on a connection whose system went away', () => {
  it('fails with origin connection, no answer, and the cause ECONNREFUSED', async () => {
    const stub = await startAdtStub();
    const connection = new AdtOnPremConnector(
      { url: stub.baseUrl, client: '100', authType: 'basic' },
      new BasicAuthProvider('STUB', 'STUB'),
      new OnPremHttpTransport(() => ({}), null, {
        client: '100',
        baseUrl: stub.baseUrl,
      }),
      null,
    );
    await connection.connect();
    await stub.close();

    try {
      const utils = new AdtUtils(connection, {
        logger: noopLogger,
        results: utilDocuments,
      });
      const answer = await utils.search({ query: 'ZCL_*' });

      expect(answer.ok).toBe(false);
      if (answer.ok) throw new Error('expected a failure');
      const failure = answer.getError();
      expect(failure.origin).toBe('connection');
      expect(failure.response).toBeUndefined();
      expect(failure.connectionCause).toBe('ECONNREFUSED');
    } finally {
      await connection.disconnect().catch(() => undefined);
    }
  });
});
