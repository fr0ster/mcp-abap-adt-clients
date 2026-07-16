/**
 * featureToggle readiness reads are a plain GET: the SFW endpoint's support for
 * withLongPolling could not be verified from the cloud trial (SFW is on-prem),
 * so we deliberately never send it. This test pins that — readFeatureToggle must
 * not put withLongPolling in the request URL or params. It guards against a
 * future "fix" that wires an unverified parameter.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { readFeatureToggle } from '../../../core/featureToggle/read';

function fakeConn(): { conn: IAbapConnection; calls: any[] } {
  const calls: any[] = [];
  const makeAdtRequest = jest.fn(async (req: any) => {
    calls.push(req);
    return { status: 200, data: '' };
  });
  return {
    conn: {
      makeAdtRequest,
      setSessionType: jest.fn(),
    } as unknown as IAbapConnection,
    calls,
  };
}

describe('readFeatureToggle never sends withLongPolling', () => {
  it('omits withLongPolling from url and params', async () => {
    const { conn, calls } = fakeConn();
    await readFeatureToggle(conn, 'ZTEST_FT', 'inactive');
    expect(calls).toHaveLength(1);
    const req = calls[0];
    expect(String(req.url)).not.toContain('withLongPolling');
    expect(req.params?.withLongPolling).toBeUndefined();
  });
});
