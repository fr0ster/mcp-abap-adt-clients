/**
 * A batch records requests to send later, in one envelope, so a request that
 * must not be logged or resent cannot be one of its parts: `AdtBatchConnection`
 * refuses any request carrying `noLog` or `noResend` with a synchronous throw,
 * before anything is queued — never as a rejected promise, since a recorder
 * above it numbers and adds an entry before it sees a rejection.
 */

import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtBatchConnection } from '../../../batch';

const REFUSED = 'this request cannot be recorded into a batch';

function fixture() {
  const sent: IAbapRequestOptions[] = [];
  const connection: IAbapConnection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example.test',
    getSessionId: () => 'session',
    setSessionType: () => {},
    makeAdtRequest: async <T = unknown, D = unknown>(
      request: IAbapRequestOptions,
    ): Promise<IAdtWireResponse<T, D>> => {
      sent.push(request);
      // `T` is the caller's to name; the multipart text is no value of every `T`.
      return {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'multipart/mixed; boundary="answer"; charset=utf-8',
        },
        data: '--answer\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 200  OK\r\nContent-Type: application/xml\r\n\r\n<body/>\r\n--answer--\r\n',
      } as unknown as IAdtWireResponse<T, D>;
    },
  };
  return {
    batch: new AdtBatchConnection(connection, { endpoint: 'communication' }),
    sent,
  };
}

const ordinary: IAbapRequestOptions = {
  method: 'GET',
  url: '/sap/bc/adt/ordinary',
  timeout: 0,
};

describe('a batch and the flagged requests', () => {
  it.each([
    ['noLog', { noLog: true }],
    ['noResend', { noResend: true }],
    ['both', { noLog: true, noResend: true }],
  ] as const)(
    'refuses a request with %s synchronously, recording nothing',
    async (_name, flags) => {
      const { batch, sent } = fixture();
      const recorded = batch.makeAdtRequest(ordinary);

      let returned: unknown;
      expect(() => {
        returned = batch.makeAdtRequest({
          method: 'POST',
          url: '/sap/bc/adt/abapgit/repos/K/push',
          timeout: 0,
          ...flags,
        });
      }).toThrow(REFUSED);
      expect(returned).toBeUndefined();

      await batch.execute();
      await recorded;
      // One envelope, holding the ordinary request alone.
      expect(sent).toHaveLength(1);
      const body = String(sent[0]?.data);
      expect(body).toContain('GET /sap/bc/adt/ordinary HTTP/1.1');
      expect(body).not.toContain('abapgit');
      expect(body.split('Content-Type: application/http').length - 1).toBe(1);
    },
  );

  it('still records an ordinary request, and one that is only stateless', async () => {
    const { batch } = fixture();

    const pending = batch.makeAdtRequest({ ...ordinary, stateless: true });

    expect(pending).toBeInstanceOf(Promise);
    await batch.execute();
    await expect(pending).resolves.toMatchObject({ status: 200 });
  });
});
