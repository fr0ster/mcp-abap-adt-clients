import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtBatchConnection } from '../../../batch';

/**
 * C1 of #304, equivalence: a batch member gets its own part, as it is — the
 * status, the headers and the body the envelope carried for it (a refused
 * part rejects with it as `response`). The type
 * parameters `<T, D>` go; what the promise resolves with does not change.
 */
describe('a batch member gets its part', () => {
  it('resolves each queued request with its own part', async () => {
    const connection = {
      makeAdtRequest: jest.fn(async () => ({
        status: 202,
        statusText: 'Accepted',
        headers: { 'content-type': 'multipart/mixed; boundary="b"' },
        data:
          '--b\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: application/xml\r\n\r\n<first/>\r\n' +
          '--b\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nnone\r\n' +
          '--b--\r\n',
      })),
      setSessionType: jest.fn(),
      connect: jest.fn(),
      getBaseUrl: async () => 'https://example.test',
      getSessionId: () => 'session',
    } satisfies IAbapConnection;
    const batch = new AdtBatchConnection(connection, {
      endpoint: 'communication',
    });
    const first = batch.makeAdtRequest({
      method: 'GET',
      url: '/a',
      timeout: 0,
    });
    const second = batch.makeAdtRequest({
      method: 'GET',
      url: '/b',
      timeout: 0,
    });
    // A part SAP refused rejects, its own part attached as `response`.
    const refused = expect(second).rejects.toMatchObject({
      response: { status: 404, data: 'none' },
    });
    await batch.execute();
    expect(await first).toMatchObject({
      status: 200,
      data: '<first/>',
      headers: { 'content-type': 'application/xml' },
    });
    await refused;
  });
});
