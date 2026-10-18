import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtBatchConnection } from '../../batch';
import { innerRequest, parseBatchResponse } from '../../batch/wire';
import { AdtClient } from '../../clients/AdtClient';
import { exemptFromAcceptNegotiation, getBaseRequest } from '../../index';
import { AbapDebugger } from '../../runtime/debugger/AbapDebugger';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { withRequestTrace } from '../../utils/requestTrace';

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

test('sends consecutive same-kind runs in order and restores the session', async () => {
  const { batch, send, session } = fixture([200]);
  const pending = [batch.makeAdtRequest(req)];
  batch.setSessionType('stateful');
  pending.push(batch.makeAdtRequest({ ...req, url: '/test?_action=LOCK' }));
  batch.setSessionType('stateful');
  pending.push(batch.makeAdtRequest({ ...req, url: '/test?_action=UNLOCK' }));
  pending.push(batch.makeAdtRequest({ ...req, method: 'PUT', data: 'é' }));
  const single = await send({});
  send.mockClear();
  send.mockResolvedValue(single);
  const result = await batch.execute();
  expect(await Promise.all(pending)).toHaveLength(4);
  expect(result).toBe(single);
  expect(send).toHaveBeenCalledTimes(4);
  const bodies = send.mock.calls.map(
    ([request]) => (request as any).data as string,
  );
  expect(bodies[0]).toContain('GET /test HTTP/1.1');
  expect(bodies[0]).not.toContain('stateful');
  expect(bodies[1]).toContain('_action=LOCK');
  expect(bodies[1]).not.toContain('_action=UNLOCK');
  expect(bodies[2]).toContain('_action=UNLOCK');
  expect(bodies[2]).not.toContain('_action=LOCK');
  expect(bodies[3]).toContain('Content-Length: 2');
  expect(bodies[3]).not.toContain('stateful');
  expect(session.mock.calls).toEqual([
    ['stateless'],
    ['stateful'],
    ['stateful'],
    ['stateless'],
    ['stateless'],
  ]);
});

test.each([
  { actions: ['LOCK', 'UNLOCK'], sizes: [1, 1] },
  { actions: ['LOCK', 'LOCK', 'UNLOCK', 'UNLOCK'], sizes: [2, 2] },
  { actions: ['CREATE', 'LOCK', 'PUT', 'UNLOCK'], sizes: [1, 1, 1, 1] },
  { actions: ['OTHER', 'LOCK', 'OTHER', 'UNLOCK'], sizes: [1, 1, 1, 1] },
])('groups communication requests $actions into envelopes $sizes', async ({
  actions,
  sizes,
}) => {
  const { batch, send } = fixture([200]);
  for (const size of sizes) {
    const response = await fixture(Array(size).fill(200)).send({});
    send.mockResolvedValueOnce(response);
  }
  const pending = actions.map((action, index) => {
    if (['LOCK', 'UNLOCK', 'OTHER'].includes(action))
      batch.setSessionType('stateful');
    return batch.makeAdtRequest({
      ...req,
      method: action === 'PUT' ? 'PUT' : 'POST',
      // Exercise both URL and params actions, including a non-action query value.
      url: index % 2 ? '/test?note=_action=LOCK' : `/test?_action=${action}`,
      params: index % 2 ? { _action: action } : undefined,
    });
  });
  await batch.execute();
  await Promise.all(pending);
  expect(
    send.mock.calls.map(
      ([request]) =>
        ((request as any).data as string).match(
          /Content-Type: application\/http/g,
        )?.length,
    ),
  ).toEqual(sizes);
});

test('a failed envelope stops later runs and rejects unsent parts without a SAP response', async () => {
  const { batch, send } = fixture([200]);
  const first = batch.makeAdtRequest(req);
  batch.setSessionType('stateful');
  const failed = batch.makeAdtRequest(req).catch((error) => error);
  const unsent = batch.makeAdtRequest(req).catch((error) => error);
  const success = await send({});
  const failure = Object.assign(new Error('offline'), {
    response: { status: 503 },
  });
  send.mockClear();
  send.mockResolvedValueOnce(success).mockRejectedValueOnce(failure);
  await expect(batch.execute()).rejects.toBe(failure);
  expect((await first).status).toBe(200);
  expect(await failed).toBe(failure);
  const skipped = await unsent;
  expect(skipped.message).toMatch(/not sent.*earlier.*envelope failed/i);
  expect(skipped.response).toBeUndefined();
  expect(send).toHaveBeenCalledTimes(2);
  expect((await batch.execute()).status).toBe(204);
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
])("a part answered %s is that call's answer, and nothing is resent", async (status) => {
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
  expect(send).toHaveBeenCalledTimes(1);
  const answer = await pending;
  expect(answer.ok).toBe(false);
  if (answer.ok) throw new Error('expected a failure');
  expect(answer.getError().response?.status).toBe(status);
});

test.each([
  406, 415,
] as const)('an AdtClient with correction switched on explicitly still resends nothing (%s)', async (status) => {
  const { batch, send } = fixture([200]);
  const success = await send({});
  send.mockClear();
  send.mockResolvedValueOnce({
    ...success,
    data: `--answer\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 ${status} Unsupported\r\nAccept: application/corrected+xml\r\nContent-Type: application/corrected+xml\r\n\r\nunsupported\r\n--answer--\r\n`,
  });
  const pending = new AdtClient(batch, undefined, {
    enableAcceptCorrection: true,
  })
    .getDomain()
    .readMetadata({ domainName: 'Z_TEST' });
  await batch.execute();
  expect(send).toHaveBeenCalledTimes(1);
  const answer = await pending;
  expect(answer.ok).toBe(false);
  if (answer.ok) throw new Error('expected a failure');
  expect(answer.getError().response?.status).toBe(status);
});

test.each([
  'lock',
  'unlock',
] as const)('%s scopes stateful mode to its own request', async (method) => {
  const { batch, send, session } = fixture([200, 200]);
  const single = await fixture([200]).send({});
  send.mockResolvedValueOnce(single);
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
  expect(send).toHaveBeenCalledTimes(2);
  expect((send.mock.calls[1][0] as any).data).not.toContain('stateful');
  expect(session.mock.calls).toEqual([
    ['stateful'],
    ['stateless'],
    ['stateless'],
  ]);
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

test.each([
  'parse',
  'count',
] as const)('%s failure rejects unsent runs and restores the wrapped mode', async (kind) => {
  const { connection, send, session } = fixture([200]);
  const batch = new AdtBatchConnection(
    { ...connection, getSessionType: () => 'stateful' } as IAbapConnection,
    { endpoint: 'communication' },
  );
  batch.setSessionType('stateless');
  const failed = batch.makeAdtRequest(req).catch((error) => error);
  batch.setSessionType('stateful');
  const unsent = batch.makeAdtRequest(req).catch((error) => error);
  const answer = await send({});
  send.mockClear();
  send.mockResolvedValueOnce({
    ...answer,
    headers: (kind === 'parse' ? {} : answer.headers) as typeof answer.headers,
    data: kind === 'parse' ? 'invalid' : '',
  });
  await expect(batch.execute()).rejects.toThrow(
    kind === 'parse' ? 'missing multipart boundary' : 'part count',
  );
  expect(await failed).toBeInstanceOf(Error);
  expect((await unsent).message).toContain('not sent');
  expect(send).toHaveBeenCalledTimes(1);
  expect(session.mock.calls.at(-1)).toEqual(['stateful']);
});

describe('a bodyless inner answer', () => {
  it("parses an UNLOCK's 200 whose empty line's CRLF belongs to the next delimiter", () => {
    // Bytes as an on-premise system answered 100 UNLOCKs (2026-10-16).
    const body =
      '--b\r\ncontent-type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\n' +
      'HTTP/1.1 200  OK\r\n~server_protocol: HTTP/1.1\r\n\r\n' +
      '--b\r\ncontent-type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\n' +
      'HTTP/1.1 200  OK\r\n~server_protocol: HTTP/1.1\r\n\r\n--b--\r\n';
    const parts = parseBatchResponse({
      status: 202,
      statusText: 'Accepted',
      headers: { 'content-type': 'multipart/mixed; boundary=b; charset=utf-8' },
      data: body,
    } as any);
    expect(parts.map((p) => [p.status, p.data])).toEqual([
      [200, ''],
      [200, ''],
    ]);
  });
});

test('communication defaults to stateless on a stateful wrapped connection, while lock stays stateful', async () => {
  const { connection, send, session } = fixture([200]);
  const batch = new AdtBatchConnection(
    { ...connection, getSessionType: () => 'stateful' } as IAbapConnection,
    { endpoint: 'communication' },
  );
  const domain = new AdtClient(batch).getDomain();
  const config = { domainName: 'Z_TEST' };
  const pending = [
    domain.readMetadata(config),
    domain.lock(config),
    domain.readMetadata(config),
  ];
  await batch.execute();
  await Promise.all(pending);
  expect(send).toHaveBeenCalledTimes(3);
  const bodies = send.mock.calls.map(([request]) => (request as any).data);
  expect(bodies[0]).not.toContain('stateful');
  expect(bodies[1]).toContain('_action=LOCK');
  expect(bodies[1]).toContain('X-sap-adt-sessiontype: stateful');
  expect(bodies[2]).not.toContain('stateful');
  expect(session.mock.calls).toEqual([
    ['stateless'],
    ['stateful'],
    ['stateless'],
    ['stateful'],
  ]);
});

test.each([
  'stateful',
  'stateless',
] as const)('debugger defaults to stateful with a %s wrapped connection', async (mode) => {
  const { connection, send, session } = fixture([200, 200]);
  const batch = new AdtBatchConnection(
    { ...connection, getSessionType: () => mode } as IAbapConnection,
    { endpoint: 'debugger' },
  );
  const api = new AbapDebugger(batch);
  const pending = [api.getStack(), api.getVariables(['id'])];
  await batch.execute();
  await Promise.all(pending);
  expect(send).toHaveBeenCalledTimes(1);
  expect(
    (send.mock.calls[0][0] as any).data.match(
      /X-sap-adt-sessiontype: stateful/g,
    ),
  ).toHaveLength(2);
  expect(session.mock.calls).toEqual([['stateful'], [mode]]);
});

test.each([
  '\r\n',
  '\n',
])('parses headerless, bodyless and boundary-like bodies together with %j lines', (eol) => {
  const body = `inline --answer${eol}--answersuffix${eol}--answer--suffix${eol}last`;
  const parts = parseBatchResponse({
    status: 202,
    statusText: 'Accepted',
    headers: { 'content-type': 'multipart/mixed; boundary=answer' },
    data: [
      '--answer',
      'Content-Type: application/http',
      '',
      'HTTP/1.1 200 OK',
      '',
      'payload',
      '--answer',
      'Content-Type: application/http',
      '',
      'HTTP/1.1 200 OK',
      '~server_protocol: HTTP/1.1',
      '',
      '--answer',
      'Content-Type: application/http',
      '',
      'HTTP/1.1 200 OK',
      'Content-Type: text/plain',
      '',
      body,
      '--answer--',
      '',
    ].join(eol),
  });
  expect(
    parts.map(({ status, headers, data }) => ({ status, headers, data })),
  ).toEqual([
    { status: 200, headers: {}, data: 'payload' },
    { status: 200, headers: { '~server_protocol': 'HTTP/1.1' }, data: '' },
    { status: 200, headers: { 'content-type': 'text/plain' }, data: body },
  ]);
});

test.each([
  '../integration/runtime/debugger/DebuggerBatch.test.ts',
])('%s names no system', (file) => {
  const source = readFileSync(join(__dirname, file), 'utf8');
  const rule = readFileSync(
    join(__dirname, 'notesNameNoSystem.test.ts'),
    'utf8',
  );
  const expression = /const FORBIDDEN =\s*(\/.*\/i);/.exec(rule)![1];
  const forbidden = new RegExp(expression.slice(1, -2), 'i');
  expect(source).not.toMatch(forbidden);
  expect(source).not.toMatch(/\b[A-Z][A-Z0-9]{2}K\d+\b/);
});

describe('accept negotiation never resends an envelope', () => {
  // A batch is the caller's: what SAP answers to the envelope is theirs to
  // read. Accept negotiation, on a connection an AdtClient wrapped with
  // correction on, would answer a 406/415 by sending the envelope again.
  function refusing(status: 406 | 415) {
    const refusal = Object.assign(new Error(`status ${status}`), {
      response: {
        status,
        statusText: 'Refused',
        headers: {
          accept: 'multipart/alternative',
          'x-sap-adt-supported-accept': 'multipart/alternative',
          'x-sap-adt-supported-content-type': 'multipart/alternative',
        },
        data: '',
      },
    });
    const send = jest.fn(async (_request: unknown) => {
      throw refusal;
    });
    const connection = {
      makeAdtRequest: send,
      setSessionType: jest.fn(),
      connect: jest.fn(),
      getBaseUrl: async () => 'https://example.test',
      getSessionId: () => 'session',
    } as unknown as IAbapConnection;
    // Wraps the connection's makeAdtRequest with accept negotiation.
    new AdtClient(connection, undefined, { enableAcceptCorrection: true });
    return { connection, send, refusal };
  }

  it.each([
    406, 415,
  ] as const)('sends an envelope answered %s once, and the parts see that answer', async (status) => {
    const { connection, send, refusal } = refusing(status);
    expect(connection.makeAdtRequest).not.toBe(send);
    const batch = new AdtBatchConnection(connection, {
      endpoint: 'communication',
    });
    const part = batch.makeAdtRequest({
      ...req,
      method: 'POST',
      data: '<x/>',
      headers: { 'Content-Type': 'application/xml' },
    });
    const settled = part.catch((error: unknown) => error);

    await expect(batch.execute()).rejects.toBe(refusal);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await settled).toBe(refusal);
  });
});

test.each([
  406, 415,
] as const)('a member that negotiates directly resends nothing through a batch (%s)', async (status) => {
  // Some members call the negotiation themselves rather than through the
  // wrapped connection: the exemption holds there too.
  const { batch, send } = fixture([200]);
  const success = await send({});
  send.mockClear();
  send.mockResolvedValueOnce({
    ...success,
    data: `--answer\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 ${status} Unsupported\r\nAccept: application/corrected+xml\r\nContent-Type: application/corrected+xml\r\n\r\nunsupported\r\n--answer--\r\n`,
  });
  const pending = makeAdtRequestWithAcceptNegotiation(
    batch,
    { ...req, headers: { Accept: 'application/xml' } },
    { enableAcceptCorrection: true },
  ).catch((error: unknown) => error);
  await batch.execute();
  expect(send).toHaveBeenCalledTimes(1);
  expect(
    ((await pending) as { response?: { status?: number } }).response?.status,
  ).toBe(status);
});

describe('a consumer wrapper over a batch connection', () => {
  // A consumer may hand members its own connection over the batch (per call,
  // say). The public mark is how that wrapper is exempt too; unmarked, it is
  // negotiated like any other connection.
  function wrapperOver(batch: AdtBatchConnection): IAbapConnection {
    return {
      makeAdtRequest: (
        request: Parameters<IAbapConnection['makeAdtRequest']>[0],
      ) => batch.makeAdtRequest(request),
      setSessionType: (mode: 'stateful' | 'stateless') =>
        batch.setSessionType(mode),
      connect: () => batch.connect(),
      getBaseUrl: () => batch.getBaseUrl(),
      getSessionId: () => batch.getSessionId(),
    } as unknown as IAbapConnection;
  }
  const refused406 = <S extends { data: string }>(success: S): S => ({
    ...success,
    data: '--answer\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 406 Unsupported\r\nAccept: application/corrected+xml\r\n\r\nunsupported\r\n--answer--\r\n',
  });

  it('marked with exemptFromAcceptNegotiation, resends nothing', async () => {
    const { batch, send } = fixture([200]);
    const success = await send({});
    send.mockClear();
    send.mockResolvedValueOnce(refused406(success));
    const wrapper = wrapperOver(batch);
    exemptFromAcceptNegotiation(wrapper);
    const pending = new AdtClient(wrapper, undefined, {
      enableAcceptCorrection: true,
    })
      .getDomain()
      .readMetadata({ domainName: 'Z_TEST' });
    await batch.execute();
    expect(send).toHaveBeenCalledTimes(1);
    const answer = await pending;
    expect(answer.ok).toBe(false);
  });

  it('unmarked, is negotiated like any other connection', async () => {
    const { batch, send } = fixture([200]);
    const success = await send({});
    send.mockClear();
    send.mockResolvedValueOnce(refused406(success));
    const pending = new AdtClient(wrapperOver(batch), undefined, {
      enableAcceptCorrection: true,
    })
      .getDomain()
      .readMetadata({ domainName: 'Z_TEST' });
    await batch.execute();
    expect(send).toHaveBeenCalledTimes(2);
    expect((await pending).ok).toBe(true);
  });
});

describe('a forwarding connection over one an AdtClient wrapped', () => {
  // A consumer whose batch wraps a forwarder of its own (a late-bound target
  // over its instance's connection, say) forwards through getBaseRequest of
  // the connection it forwards to: the envelope then bypasses that
  // connection's accept negotiation and is sent once.
  function wrappedRefusing406() {
    const refusal = Object.assign(new Error('status 406'), {
      response: {
        status: 406,
        statusText: 'Refused',
        headers: { 'x-sap-adt-supported-accept': 'multipart/alternative' },
        data: '',
      },
    });
    const send = jest.fn(async (_request: unknown) => {
      throw refusal;
    });
    const connection = {
      makeAdtRequest: send,
      setSessionType: jest.fn(),
      connect: jest.fn(),
      getBaseUrl: async () => 'https://example.test',
      getSessionId: () => 'session',
    } as unknown as IAbapConnection;
    new AdtClient(connection, undefined, { enableAcceptCorrection: true });
    return { connection, send, refusal };
  }
  function forwarder(
    to: IAbapConnection,
    request: IAbapConnection['makeAdtRequest'],
  ): IAbapConnection {
    return {
      makeAdtRequest: request,
      setSessionType: (mode: 'stateful' | 'stateless') =>
        to.setSessionType(mode),
      connect: () => to.connect(),
      getBaseUrl: () => to.getBaseUrl(),
      getSessionId: () => to.getSessionId(),
    } as unknown as IAbapConnection;
  }

  it('forwarding through getBaseRequest sends the envelope once', async () => {
    const { connection, send, refusal } = wrappedRefusing406();
    const batch = new AdtBatchConnection(
      forwarder(connection, (r) => getBaseRequest(connection)(r)),
      { endpoint: 'communication' },
    );
    const part = batch.makeAdtRequest(req).catch((e: unknown) => e);
    await expect(batch.execute()).rejects.toBe(refusal);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await part).toBe(refusal);
  });

  it('forwarding through the wrapped makeAdtRequest sends it again', async () => {
    const { connection, send } = wrappedRefusing406();
    const batch = new AdtBatchConnection(
      forwarder(connection, (r) => connection.makeAdtRequest(r)),
      { endpoint: 'communication' },
    );
    const part = batch.makeAdtRequest(req).catch((e: unknown) => e);
    await batch.execute().catch(() => undefined);
    await part;
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('an envelope that fails as a whole', () => {
  // Every part goes through the request trace, which writes the part's own
  // request onto what it throws. The envelope's failure is one object shared
  // by every part, so each part wrote over the one before it and all of them
  // ended up naming the last part — a request never sent on its own.
  const parts = [
    { method: 'GET', url: '/sap/bc/adt/ddic/domains/z_first', timeout: 0 },
    { method: 'GET', url: '/sap/bc/adt/ddic/domains/z_second', timeout: 0 },
    { method: 'GET', url: '/sap/bc/adt/ddic/domains/z_third', timeout: 0 },
  ];

  it.each([
    [
      'an outer 500',
      () =>
        Object.assign(new Error('Request failed with status code 500'), {
          response: { status: 500, statusText: 'Internal', headers: {} },
        }),
    ],
    [
      'a transport throw',
      () =>
        Object.assign(new Error('socket hang up'), {
          request: { aNativeRequestObject: true },
        }),
    ],
  ])('rejects every part with the same object, naming the envelope POST (%s)', async (_name, make) => {
    const { batch, send } = fixture();
    const failure = make();
    send.mockRejectedValueOnce(failure);
    const traced = withRequestTrace(batch);
    const settled = parts.map((part) =>
      traced.makeAdtRequest(part).catch((error: unknown) => error),
    );

    await expect(batch.execute()).rejects.toBe(failure);
    const errors = await Promise.all(settled);

    expect(errors).toEqual([failure, failure, failure]);
    for (const error of errors) expect(error).toBe(failure);
    expect(failure.message).toBe(make().message);
    expect((failure as { request?: unknown }).request).toEqual({
      method: 'POST',
      url: '/sap/bc/adt/communication/batch',
    });
  });

  it.each([
    ['recorded directly', false],
    ['through the request trace', true],
  ])('settles every part with a frozen failure as it came (%s)', async (_name, trace) => {
    // A failure that cannot be written onto: the annotation must not stop the
    // parts from settling, nor replace what `execute()` throws.
    const { batch, send } = fixture();
    const failure = Object.freeze(new Error('offline'));
    send.mockRejectedValueOnce(failure);
    const connection = trace ? withRequestTrace(batch) : batch;
    const outcomes: unknown[] = parts.map(() => 'pending');
    const settled = parts.map((part, index) =>
      connection.makeAdtRequest(part).then(
        (answer: unknown) => {
          outcomes[index] = answer;
        },
        (error: unknown) => {
          outcomes[index] = error;
        },
      ),
    );

    await expect(batch.execute()).rejects.toBe(failure);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(outcomes).toEqual([failure, failure, failure]);
    for (const outcome of outcomes) expect(outcome).toBe(failure);
    await Promise.all(settled);
  });

  it('leaves the "not sent" failure of a later envelope naming no part', async () => {
    const { batch, send } = fixture([200]);
    const failure = new Error('offline');
    const traced = withRequestTrace(batch);
    const failed = traced.makeAdtRequest(parts[0]).catch((e: unknown) => e);
    batch.setSessionType('stateful');
    const lock = { ...parts[1], url: `${parts[1].url}?_action=LOCK` };
    const unsent = [
      traced.makeAdtRequest(lock).catch((e: unknown) => e),
      traced
        .makeAdtRequest({ ...parts[2], url: `${parts[2].url}?_action=LOCK` })
        .catch((e: unknown) => e),
    ];
    send.mockRejectedValueOnce(failure);

    await expect(batch.execute()).rejects.toBe(failure);
    expect(await failed).toBe(failure);
    const [a, b] = (await Promise.all(unsent)) as Error[];
    expect(a).toBe(b);
    expect(a.message).toMatch(/not sent/);
    expect((a as { request?: unknown }).request).toBeUndefined();
    expect(a.cause).toBe(failure);
  });
});
