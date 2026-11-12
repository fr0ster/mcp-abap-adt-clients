/**
 * The system probes answer "the endpoint is not there" and raise everything
 * else.
 *
 * Until 23.0.0 each swallowed every failure into the same answer as an absent
 * endpoint — `false`, `null`, an empty set — so a modern system reached over a
 * broken connection got a legacy client from `createAdtClient`, and a failed
 * discovery read as a system that offers nothing.
 */
import type { IAnalyse } from '@mcp-abap-adt/interfaces-adt';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import {
  ADT_SESSION_ERROR,
  type IAbapConnection,
  type IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { fetchDiscoveryEndpoints } from '../../../utils/discoveryEndpoints';
import {
  getSystemInformation,
  isCloudEnvironment,
  isModernAdtSystem,
} from '../../../utils/systemInfo';

const failingWith = (status?: number): IAbapConnection =>
  ({
    makeAdtRequest: async () => {
      const error: any = new Error(status ? `HTTP ${status}` : 'ECONNRESET');
      if (status) error.response = { status, headers: {}, data: '' };
      throw error;
    },
  }) as unknown as IAbapConnection;

const answering = (headers: Record<string, string>, data = '') =>
  ({
    makeAdtRequest: async () => ({
      data,
      status: 200,
      statusText: 'OK',
      headers,
    }),
  }) as unknown as IAbapConnection;

describe('isModernAdtSystem', () => {
  it('an XML core/discovery is a modern system', async () => {
    await expect(
      isModernAdtSystem(
        answering({ 'content-type': 'application/atomsvc+xml' }),
      ),
    ).resolves.toBe(true);
  });

  it.each([404, 405, 501])(
    'a %i is a system without core discovery',
    async (status) => {
      await expect(isModernAdtSystem(failingWith(status))).resolves.toBe(false);
    },
  );

  it.each([401, 500, undefined])(
    'a %s failure is raised, not read as a system without it',
    async (status) => {
      await expect(isModernAdtSystem(failingWith(status))).rejects.toThrow();
    },
  );
});

describe('getSystemInformation', () => {
  const RECORD = {
    systemID: 'SYS',
    userName: 'DEVELOPER',
    userFullName: 'A Developer',
    client: '100',
    language: 'EN',
  };

  const replying = (status: number, data: unknown) =>
    ({
      makeAdtRequest: async () => ({
        data,
        status,
        statusText: '',
        headers: {},
      }),
    }) as unknown as IAbapConnection;

  it.each([
    ['a JSON string', JSON.stringify(RECORD)],
    ['an object', RECORD],
  ])('a 200 with %s is the record', async (_, data) => {
    const answer = await getSystemInformation(replying(200, data));
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.getResult().value).toEqual({ present: true, info: RECORD });
  });

  it('a field that is not a string is not read', async () => {
    const answer = await getSystemInformation(
      replying(200, { systemID: 7, userName: 'DEVELOPER' }),
    );
    if (!answer.ok) throw new Error('expected a success');
    expect(answer.getResult().value).toEqual({
      present: true,
      info: {
        systemID: undefined,
        userName: 'DEVELOPER',
        userFullName: undefined,
        client: undefined,
        language: undefined,
      },
    });
  });

  it.each([
    ['an HTML page', '<html><body>Logon</body></html>'],
    ['an empty body', ''],
    ['JSON that is no object', '[1, 2]'],
    ['JSON null', 'null'],
  ])('a 200 with %s is a failure, not an absent endpoint', async (_, data) => {
    const answer = await getSystemInformation(replying(200, data));
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    const error = answer.getError();
    expect(error.origin).toBe('connection');
    expect(error.response?.status).toBe(200);
    expect(error.request).toEqual({
      method: 'GET',
      url: '/sap/bc/adt/core/http/systeminformation',
    });
  });

  it('a 404 (on-premise, no such endpoint) is the endpoint absent', async () => {
    const answer = await getSystemInformation(failingWith(404));
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.getResult().value).toEqual({ present: false });
  });

  it('a 404 a connection hands back instead of throwing is absent too', async () => {
    const answer = await getSystemInformation(replying(404, ''));
    if (!answer.ok) throw new Error('expected a success');
    expect(answer.getResult().value).toEqual({ present: false });
  });

  it.each([405, 501, 500, 401])(
    'a %i is a failure carrying its status',
    async (status) => {
      const answer = await getSystemInformation(failingWith(status));
      expect(answer.ok).toBe(false);
      if (answer.ok) return;
      expect(answer.getError().origin).toBe('connection');
      expect(answer.getError().response?.status).toBe(status);
    },
  );

  it('a 500 a connection hands back instead of throwing is a failure, whatever its body', async () => {
    const answer = await getSystemInformation(replying(500, RECORD));
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.getError().response?.status).toBe(500);
  });

  it('a network failure is a failure with no response', async () => {
    const answer = await getSystemInformation(failingWith());
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.getError()).toMatchObject({
      origin: 'connection',
      message: 'ECONNRESET',
    });
    expect(answer.getError().response).toBeUndefined();
  });

  describe("the caller's analyse", () => {
    it("sees every verdict with its answer, the library's first", async () => {
      const seen: unknown[] = [];
      const analyse: IAnalyse = (verdict, wire) => {
        seen.push([verdict, wire?.status]);
        return verdict;
      };
      await getSystemInformation(failingWith(404), { analyse });
      await getSystemInformation(replying(200, 'not json'), { analyse });
      expect(seen[0]).toEqual([ADT_NO_FAILURE, 404]);
      expect(seen[1]).toEqual([
        expect.objectContaining({ origin: 'connection' }),
        200,
      ]);
    });

    it('may name a 404 a failure (a cloud system must have the endpoint)', async () => {
      const answer = await getSystemInformation(failingWith(404), {
        analyse: (verdict, wire) =>
          wire?.status === 404
            ? { origin: 'refusal', message: 'cloud without it', response: wire }
            : verdict,
      });
      expect(answer.ok).toBe(false);
      if (answer.ok) return;
      expect(answer.getError().message).toBe('cloud without it');
    });

    it('may clear a 405 or 501, which is then the endpoint absent', async () => {
      const clearing: IAnalyse = (verdict, wire) =>
        wire && [405, 501].includes(wire.status) ? ADT_NO_FAILURE : verdict;
      for (const status of [405, 501]) {
        const answer = await getSystemInformation(failingWith(status), {
          analyse: clearing,
        });
        if (!answer.ok) throw new Error(`expected ${status} cleared`);
        expect(answer.getResult().value).toEqual({ present: false });
      }
    });

    it('may clear a malformed 200, which is then a record naming nothing', async () => {
      const answer = await getSystemInformation(replying(200, '<html/>'), {
        analyse: () => ADT_NO_FAILURE,
      });
      if (!answer.ok) throw new Error('expected a success');
      expect(answer.getResult().value).toEqual({
        present: true,
        info: {
          systemID: undefined,
          userName: undefined,
          userFullName: undefined,
          client: undefined,
          language: undefined,
        },
      });
    });

    it('cannot clear a failure that carried no answer', async () => {
      const answer = await getSystemInformation(failingWith(), {
        analyse: () => ADT_NO_FAILURE,
      });
      expect(answer.ok).toBe(false);
    });
  });
});

describe('isCloudEnvironment, asking systeminformation', () => {
  const at = (
    reply: () => Promise<unknown>,
    baseUrl = 'https://system.example',
  ): IAbapConnection =>
    ({
      getBaseUrl: async () => baseUrl,
      makeAdtRequest: reply,
    }) as unknown as IAbapConnection;

  const ok = (data: unknown) => async () => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
  });
  const failing = (status?: number) => async () => {
    const error: any = new Error(status ? `HTTP ${status}` : 'ECONNRESET');
    if (status) error.response = { status, headers: {}, data: '' };
    throw error;
  };

  it('an answering endpoint reads as cloud', async () => {
    await expect(
      isCloudEnvironment(at(ok('{"systemID":"SYS"}'))),
    ).resolves.toBe(true);
  });

  it('a 404 reads as on-premise', async () => {
    await expect(isCloudEnvironment(at(failing(404)))).resolves.toBe(false);
  });

  it('a malformed 200 is raised, never read as on-premise', async () => {
    await expect(
      isCloudEnvironment(at(ok('<html>Logon</html>'))),
    ).rejects.toThrow();
  });

  it.each([405, 501, 500, undefined])(
    'a %s failure is raised, never read as on-premise',
    async (status) => {
      await expect(isCloudEnvironment(at(failing(status)))).rejects.toThrow();
    },
  );

  it('a hana.ondemand.com URL is cloud without a request', async () => {
    const reply = jest.fn(failing(500));
    await expect(
      isCloudEnvironment(at(reply, 'https://x.abap.eu10.hana.ondemand.com')),
    ).resolves.toBe(true);
    expect(reply).not.toHaveBeenCalled();
  });
});

describe('fetchDiscoveryEndpoints', () => {
  it('reads the hrefs of an answering discovery', async () => {
    const endpoints = await fetchDiscoveryEndpoints(
      answering({}, '<app:collection href="/sap/bc/adt/oo/classes"/>'),
    );
    expect([...endpoints]).toEqual(['/sap/bc/adt/oo/classes']);
  });

  it('no discovery resource is an empty set; a 500 is raised', async () => {
    await expect(fetchDiscoveryEndpoints(failingWith(404))).resolves.toEqual(
      new Set(),
    );
    await expect(fetchDiscoveryEndpoints(failingWith(500))).rejects.toThrow();
  });
});

describe('getSystemInformation: the session mark of its one request', () => {
  const REPLACED = ADT_SESSION_ERROR.SESSION_REPLACED;

  /** A connection whose one request rejects with `thrown`. */
  const throwing = (thrown: unknown): IAbapConnection => ({
    connect: async () => undefined,
    getBaseUrl: async () => undefined,
    getSessionId: () => null,
    setSessionType: () => undefined,
    makeAdtRequest: async () => {
      throw thrown;
    },
  });

  /** A connection whose one request resolves `wire`. */
  const resolving = (wire: IAdtWireResponse): IAbapConnection => ({
    connect: async () => undefined,
    getBaseUrl: async () => undefined,
    getSessionId: () => null,
    setSessionType: () => undefined,
    makeAdtRequest: async <T, D>() => wire as IAdtWireResponse<T, D>,
  });

  /** SAP's refusal, marked on the error itself as connection 23.0.0 does. */
  const markedRefusal = (status: number) =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
      response: { status, statusText: 'x', headers: {}, data: '' },
      sessionLost: REPLACED,
    });

  const markedWire = (status: number, data: unknown): IAdtWireResponse => ({
    status,
    statusText: 'x',
    headers: {},
    data,
    sessionLost: REPLACED,
  });

  it('a marked thrown 404: the endpoint absent, with the mark', async () => {
    const answer = await getSystemInformation(throwing(markedRefusal(404)));

    if (!answer.ok) throw new Error('expected a success');
    expect(answer.getResult()).toEqual({
      value: { present: false },
      sessionLost: REPLACED,
    });
  });

  it('a marked non-2xx answer: the verdict carries the mark', async () => {
    const answer = await getSystemInformation(resolving(markedWire(500, '')));

    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().sessionLost).toBe(REPLACED);
  });

  it('a marked 2xx with an unreadable body: the verdict carries the mark', async () => {
    const answer = await getSystemInformation(
      resolving(markedWire(200, 'not json')),
    );

    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().sessionLost).toBe(REPLACED);
  });

  it('a marked thrown refusal: the verdict carries the mark', async () => {
    const answer = await getSystemInformation(throwing(markedRefusal(500)));

    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().sessionLost).toBe(REPLACED);
  });

  it('a marked thrown refusal cleared by analyse: the success carries the mark', async () => {
    const clears: IAnalyse = () => ADT_NO_FAILURE;
    const answer = await getSystemInformation(throwing(markedRefusal(500)), {
      analyse: clears,
    });

    if (!answer.ok) throw new Error('expected a success');
    expect(answer.getResult().sessionLost).toBe(REPLACED);
  });

  it('a marked readable 2xx: the success carries the mark', async () => {
    const answer = await getSystemInformation(
      resolving(markedWire(200, { systemID: 'X' })),
    );

    if (!answer.ok) throw new Error('expected a success');
    expect(answer.getResult().value.present).toBe(true);
    expect(answer.getResult().sessionLost).toBe(REPLACED);
  });

  it('an unmarked readable 2xx: no key on the result', async () => {
    const { sessionLost: _, ...unmarked } = markedWire(200, { systemID: 'X' });
    const answer = await getSystemInformation(resolving(unmarked));

    if (!answer.ok) throw new Error('expected a success');
    expect('sessionLost' in answer.getResult()).toBe(false);
  });
});
