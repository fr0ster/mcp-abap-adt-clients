import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { recordRequests } from '../../helpers/requestRecorder';

/** A stand-in connection with private state, so `this` must stay the target. */
class StubConnection {
  #baseUrl = 'https://example';
  readonly types: string[] = [];
  constructor(private readonly answer: () => Promise<unknown>) {}
  async getBaseUrl() {
    return this.#baseUrl;
  }
  setSessionType(type: string) {
    this.types.push(type);
  }
  async makeAdtRequest() {
    return this.answer();
  }
}

function stub(answer: () => Promise<unknown>) {
  const target = new StubConnection(answer);
  return {
    target,
    connection: target as unknown as IAbapConnection,
  };
}

describe('request recorder', () => {
  it('records every request with the status it was answered with', async () => {
    const { connection } = stub(async () => ({ status: 200, data: 'ok' }));
    const recorder = recordRequests(connection);

    const answer = await recorder.connection.makeAdtRequest({
      url: '/sap/bc/adt/guard?x=1',
      method: 'POST',
      timeout: 0,
      params: { lockHandle: 'GUARD' },
      data: '<options/>',
      headers: { Accept: 'application/xml' },
    });

    expect(answer).toEqual({ status: 200, data: 'ok' });
    expect(recorder.requests).toEqual([
      {
        method: 'POST',
        url: '/sap/bc/adt/guard?x=1',
        params: { lockHandle: 'GUARD' },
        data: '<options/>',
        headers: { Accept: 'application/xml' },
        status: 200,
      },
    ]);
  });

  it('records the status of a failed request and rethrows the same error', async () => {
    const error = Object.assign(new Error('not found'), {
      response: { status: 404 },
    });
    const { connection } = stub(async () => {
      throw error;
    });
    const recorder = recordRequests(connection);

    const thrown = await recorder.connection
      .makeAdtRequest({ url: '/sap/bc/adt/guard', method: 'GET', timeout: 0 })
      .catch((e: unknown) => e);

    expect(thrown).toBe(error);
    expect(recorder.requests.map((r) => [r.method, r.url, r.status])).toEqual([
      ['GET', '/sap/bc/adt/guard', 404],
    ]);
  });

  it('records the session types set and forwards them', () => {
    const { target, connection } = stub(async () => ({ status: 200 }));
    const recorder = recordRequests(connection);

    recorder.connection.setSessionType('stateful');

    expect(recorder.sessionTypes).toEqual(['stateful']);
    expect(target.types).toEqual(['stateful']);
  });

  it('forwards every other member on the connection itself', async () => {
    const { connection } = stub(async () => ({ status: 200 }));
    const recorder = recordRequests(connection);

    await expect(recorder.connection.getBaseUrl()).resolves.toBe(
      'https://example',
    );
    expect(recorder.requests).toEqual([]);
  });
});
