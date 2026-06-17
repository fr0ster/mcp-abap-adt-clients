import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtFunctionInclude } from '../../../core/functionInclude/AdtFunctionInclude';

function makeConn() {
  const calls: Array<{ url: string; method?: string }> = [];
  const makeAdtRequest = jest.fn(
    async (opts: { url: string; method?: string }) => {
      calls.push(opts);
      return { status: 200, data: 'DATA: gv TYPE i.' };
    },
  );
  const connection = {
    makeAdtRequest,
    setSessionType: jest.fn(),
    getSessionId: jest.fn(),
  } as unknown as IAbapConnection;
  return { connection, calls };
}

describe('AdtFunctionInclude read() vs readMetadata()', () => {
  it('read() returns source (hits the /source/main endpoint)', async () => {
    const { connection, calls } = makeConn();
    const fi = new AdtFunctionInclude(connection);
    const state = await fi.read({
      functionGroupName: 'ZG',
      includeName: 'LZG_C01',
    });
    expect(state?.readResult).toBeDefined();
    expect(
      calls.some((c) => c.url.toLowerCase().includes('/source/main')),
    ).toBe(true);
  });

  it('readMetadata() reads the include metadata (NOT the source endpoint)', async () => {
    const { connection, calls } = makeConn();
    const fi = new AdtFunctionInclude(connection);
    await fi.readMetadata({ functionGroupName: 'ZG', includeName: 'LZG_C01' });
    const url = calls[0]?.url.toLowerCase() ?? '';
    expect(url).toContain('/includes/lzg_c01');
    expect(url).not.toContain('/source/main');
  });
});
