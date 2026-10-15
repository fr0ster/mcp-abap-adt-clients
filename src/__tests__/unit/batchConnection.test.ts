import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtBatchConnection } from '../../batch';
import { innerRequest, parseBatchResponse } from '../../batch/wire';
import { AdtClient } from '../../clients/AdtClient';
import { AbapDebugger } from '../../runtime/debugger/AbapDebugger';

function fixture(statuses = [200, 200]) {
  const send = jest.fn(async (_request: unknown) => ({
    status: 202,
    statusText: 'Accepted',
    headers: {
      'content-type': 'multipart/mixed; boundary="answer"; charset=utf-8',
    },
    data:
      statuses
        .map(
          (s, i) =>
            `--answer\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 ${s}  Result\r\n~server_protocol: HTTP/1.1\r\nContent-Type: application/xml\r\n\r\n<body>${i}</body>\r\n`,
        )
        .join('') + '--answer--\r\n',
  }));
  const session = jest.fn();
  const connection = {
    makeAdtRequest: send,
    setSessionType: session,
    connect: jest.fn(),
    getBaseUrl: async () => 'https://example.test',
    getSessionId: () => 'session',
  } as unknown as IAbapConnection;
  return {
    batch: new AdtBatchConnection(connection, { endpoint: 'communication' }),
    send,
    session,
    connection,
  };
}
const req = { method: 'GET', url: '/test', timeout: 0 };

test('records, frames bytes and settles in order with stateful envelope', async () => {
  const { batch, send, session } = fixture();
  batch.setSessionType('stateful');
  const a = batch.makeAdtRequest(req);
  batch.setSessionType('stateless');
  const b = batch.makeAdtRequest({ ...req, method: 'PUT', data: 'é' });
  expect(send).not.toHaveBeenCalled();
  await batch.execute();
  expect((await a).data).toBe('<body>0</body>');
  expect((await b).data).toBe('<body>1</body>');
  const sent = send.mock.calls[0][0] as unknown as {
    data: string;
    headers: Record<string, string>;
  };
  const boundary = sent.headers['Content-Type'].split('boundary=')[1];
  expect(sent.data).toBe(
    `--${boundary}\r\nContent-Type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\nGET /test HTTP/1.1\r\nX-sap-adt-sessiontype: stateful\r\n\r\n\r\n--${boundary}\r\nContent-Type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\nPUT /test HTTP/1.1\r\nContent-Length: 2\r\n\r\né\r\n\r\n--${boundary}--\r\n`,
  );
  expect(session.mock.calls).toEqual([['stateful'], ['stateless']]);
});
test('part failure carries response while another succeeds', async () => {
  const { batch } = fixture([404, 200]);
  const a = batch.makeAdtRequest(req).catch((e) => e);
  const b = batch.makeAdtRequest(req);
  await batch.execute();
  expect((await a).response.status).toBe(404);
  expect((await b).status).toBe(200);
});
test('envelope failure rejects all; queue reusable; empty sends nothing', async () => {
  const { batch, send } = fixture();
  const failure = new Error('offline');
  send.mockRejectedValueOnce(failure);
  const pending = [batch.makeAdtRequest(req), batch.makeAdtRequest(req)].map(
    (p) => p.catch((e) => e),
  );
  await expect(batch.execute()).rejects.toBe(failure);
  expect(await Promise.all(pending)).toEqual([failure, failure]);
  expect((await batch.execute()).status).toBe(204);
  expect(send).toHaveBeenCalledTimes(1);
});
test('member response is identical to direct transport', async () => {
  const { batch, connection } = fixture([200]);
  const pending = new AdtClient(batch)
    .getDomain()
    .readMetadata({ domainName: 'Z_TEST' });
  await batch.execute();
  const response = await pending;
  const direct = {
    ...connection,
    makeAdtRequest: async () =>
      ({
        status: 200,
        headers: {},
        data: '<body>0</body>',
      }) as IAdtWireResponse,
  } as IAbapConnection;
  const expected = await new AdtClient(direct)
    .getDomain()
    .readMetadata({ domainName: 'Z_TEST' });
  expect(response.ok).toBe(expected.ok);
  if (response.ok && expected.ok)
    expect(response.getResult()).toEqual(expected.getResult());
});
test('debugger records step, stack and variables', async () => {
  const { connection, send } = fixture([200, 200, 200]);
  const batch = new AdtBatchConnection(connection, { endpoint: 'debugger' });
  const api = new AbapDebugger(batch);
  const pending = [
    api.step('stepOver'),
    api.getStack(),
    api.getVariables(['id']),
  ];
  await batch.execute();
  expect((await Promise.all(pending)).every((r) => r.ok)).toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
});

describe('innerRequest without a body', () => {
  it('sends a lock or unlock (data: null) with no body and no Content-Length', () => {
    const text = innerRequest({
      url: '/sap/bc/adt/ddic/domains/z?_action=LOCK&accessMode=MODIFY',
      method: 'POST',
      timeout: 0,
      data: null,
      headers: { 'X-sap-adt-sessiontype': 'stateful' },
    } as any);
    expect(text).not.toContain('null');
    expect(text).not.toMatch(/content-length/i);
    expect(text.endsWith('\r\n\r\n')).toBe(true);
  });
});

test.each([
  406, 415,
])('execute settles member negotiation for %s', async (status) => {
  const { batch, send } = fixture([200]);
  const success = await send({});
  send.mockClear();
  send.mockResolvedValueOnce({
    ...success,
    data: `--answer\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 ${status} Unsupported\r\nAccept: application/corrected+xml\r\nContent-Type: application/corrected+xml\r\n\r\nunsupported\r\n--answer--\r\n`,
  });
  const pending = new AdtClient(batch)
    .getDomain()
    .readMetadata({ domainName: 'Z_TEST' });
  await batch.execute();
  expect(send).toHaveBeenCalledTimes(2);
  expect((await pending).ok).toBe(true);
  expect((send.mock.calls[1][0] as any).data).toContain(
    `${status === 406 ? 'Accept' : 'Content-Type'}: application/corrected+xml`,
  );
});

test.each([
  'lock',
  'unlock',
] as const)('%s scopes stateful mode to its own request', async (method) => {
  const { batch, send } = fixture([200, 200, 200]);
  const domain = new AdtClient(batch).getDomain();
  const config = {
    domainName: 'Z_TEST',
    packageName: '$TMP',
    description: 'Test',
  };
  const pending = [
    method === 'lock' ? domain.lock(config) : domain.unlock(config, 'handle'),
    domain.readMetadata(config),
    domain.create(config),
  ];
  await batch.execute();
  await Promise.all(pending);
  const body = (send.mock.calls[0][0] as any).data as string;
  expect(body.match(/X-sap-adt-sessiontype: stateful/g)).toHaveLength(1);
  expect(body).toMatch(
    new RegExp(
      `_action=${method.toUpperCase()}[^]*?X-sap-adt-sessiontype: stateful`,
    ),
  );
});

test.each([
  '\r\n',
  '\n',
])('multipart delimiters preserve body text with %j lines', (eol) => {
  const body = `inline --answer${eol}--answersuffix${eol}--answer--suffix${eol}last`;
  const parts = parseBatchResponse({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'multipart/mixed; boundary=answer' },
    data: `--answer \t${eol}Content-Type: application/http${eol}${eol}HTTP/1.1 200 OK${eol}Content-Type: text/plain${eol}${eol}${body}${eol}--answer--${eol}`,
  });
  expect(parts).toHaveLength(1);
  expect(parts[0].data).toBe(body);
});

test('settlement chains are bounded and all recorded requests settle', async () => {
  const { batch, send } = fixture([200]);
  const answers: unknown[] = [];
  const chain = async (): Promise<void> => {
    for (;;) {
      try {
        answers.push(await batch.makeAdtRequest(req));
      } catch (error) {
        answers.push(error);
        return;
      }
    }
  };
  const pending = chain();
  await expect(batch.execute()).rejects.toThrow('exceeded 100');
  await pending;
  expect(send).toHaveBeenCalledTimes(100);
  expect(answers).toHaveLength(101);
  expect((await batch.execute()).status).toBe(204);
});

test('envelope failures settle calls recorded while sending and their retries', async () => {
  const { batch, send } = fixture([200]);
  const failure = Object.assign(new Error('envelope failed'), {
    response: { status: 406, headers: { accept: 'application/corrected+xml' } },
  });
  const domain = new AdtClient(batch).getDomain();
  const first = domain.readMetadata({ domainName: 'Z_FIRST' });
  let second: typeof first;
  send.mockImplementationOnce(async () => {
    second = domain.readMetadata({ domainName: 'Z_SECOND' });
    throw failure;
  });
  await expect(batch.execute()).rejects.toBe(failure);
  expect((await first).ok).toBe(false);
  expect((await second!).ok).toBe(false);
  expect((await batch.execute()).status).toBe(204);
});
