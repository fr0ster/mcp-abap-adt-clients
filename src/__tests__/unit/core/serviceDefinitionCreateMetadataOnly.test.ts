/**
 * create() is metadata-only: the POST to the SRVD create endpoint carries the
 * object metadata (name, package, description) but never the source code, even
 * when sourceCode is passed. This is the invariant behind removing the dead
 * source_code create-param — source is written by update(), as in Eclipse ADT.
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtServiceDefinition } from '../../../core/serviceDefinition/AdtServiceDefinition';
import { createTestsLogger } from '../../helpers/testLogger';

const logger: ILogger = createTestsLogger();
const UNIQUE_SOURCE = 'define service ZUNIQUE_SRC_MARKER { expose ZFOO; }';

function fakeConn(): { conn: IAbapConnection; calls: any[] } {
  const calls: any[] = [];
  const makeAdtRequest = jest.fn(async (req: any) => {
    calls.push(req);
    return { status: 201, data: '' };
  });
  return {
    conn: {
      makeAdtRequest,
      setSessionType: jest.fn(),
    } as unknown as IAbapConnection,
    calls,
  };
}

describe('AdtServiceDefinition.create is metadata-only', () => {
  it('does not put source code in the create POST body', async () => {
    const { conn, calls } = fakeConn();
    const handler = new AdtServiceDefinition(conn, logger);

    await handler.create(
      {
        serviceDefinitionName: 'ZMETA_ONLY',
        packageName: 'ZPKG',
        description: 'meta only',
        sourceCode: UNIQUE_SOURCE,
      },
      { sourceCode: UNIQUE_SOURCE },
    );

    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts.length).toBeGreaterThan(0);
    for (const req of posts) {
      const body =
        typeof req.data === 'string'
          ? req.data
          : JSON.stringify(req.data ?? '');
      expect(body).not.toContain('ZUNIQUE_SRC_MARKER');
    }
  });
});
