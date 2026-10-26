import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { withRequestTrace } from '../../../utils/requestTrace';
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

  it('in deny mode records a request and throws without forwarding it', async () => {
    let forwarded = 0;
    const { connection } = stub(async () => {
      forwarded += 1;
      return { status: 200 };
    });
    const recorder = recordRequests(connection, { deny: true });

    const thrown = await recorder.connection
      .makeAdtRequest({
        url: '/sap/bc/adt/guard',
        method: 'DELETE',
        timeout: 0,
      })
      .catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      'request denied by the recorder: DELETE /sap/bc/adt/guard',
    );
    expect(forwarded).toBe(0);
    expect(recorder.requests).toEqual([
      { method: 'DELETE', url: '/sap/bc/adt/guard' },
    ]);
  });

  it('in deny mode still forwards the other members', async () => {
    const { target, connection } = stub(async () => ({ status: 200 }));
    const recorder = recordRequests(connection, { deny: true });

    recorder.connection.setSessionType('stateful');

    expect(recorder.sessionTypes).toEqual(['stateful']);
    expect(target.types).toEqual(['stateful']);
    await expect(recorder.connection.getBaseUrl()).resolves.toBe(
      'https://example',
    );
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

  describe('one entry per wire request', () => {
    const request = {
      url: '/sap/bc/adt/guard',
      method: 'GET',
      timeout: 0,
    } as const;

    /** A stub that counts what reached its wire. */
    function counting() {
      let wire = 0;
      const { target, connection } = stub(async () => {
        wire += 1;
        return { status: 200 };
      });
      return { target, connection, sent: () => wire };
    }

    // What every client does to the connection it is given (AdtClient,
    // AdtExecutor, AdtUtils, AdtRuntimeClient): `withRequestTrace` replaces
    // `makeAdtRequest` by assignment on that object — here, the recorder.
    it('a client wrapping the recorder records each request once', async () => {
      const { connection, sent } = counting();
      const recorder = recordRequests(connection);
      const client = withRequestTrace(recorder.connection);

      await client.makeAdtRequest(request);
      await client.makeAdtRequest(request);

      expect(sent()).toBe(2);
      expect(recorder.requests.map((r) => [r.method, r.url, r.status])).toEqual(
        [
          ['GET', '/sap/bc/adt/guard', 200],
          ['GET', '/sap/bc/adt/guard', 200],
        ],
      );
    });

    it('a client wrapping the recorder leaves the connection itself alone', () => {
      const { target, connection } = counting();
      const recorder = recordRequests(connection);

      withRequestTrace(recorder.connection);

      expect(Object.hasOwn(target, 'makeAdtRequest')).toBe(false);
    });

    it('a deny recorder on the same connection does not deny the forwarding one', async () => {
      const { connection, sent } = counting();
      const forwarding = recordRequests(connection);
      const forwardingClient = withRequestTrace(forwarding.connection);
      const denying = recordRequests(connection, { deny: true });
      const denyingClient = withRequestTrace(denying.connection);

      const refused = await denyingClient
        .makeAdtRequest(request)
        .catch((e: unknown) => e);
      const answer = await forwardingClient.makeAdtRequest(request);

      expect(refused).toBeInstanceOf(Error);
      expect(answer).toMatchObject({ status: 200 });
      expect(sent()).toBe(1);
      expect(forwarding.requests).toHaveLength(1);
      expect(denying.requests).toHaveLength(1);
    });

    // A connection that re-enters `this.makeAdtRequest` (a retry or session
    // layer): the inner call runs on the connection itself, not the recorder,
    // so one call from the client is one entry.
    it('a connection re-entering this.makeAdtRequest is recorded once', async () => {
      let wire = 0;
      const reentrant = {
        async makeAdtRequest(
          this: { makeAdtRequest(r: unknown): Promise<unknown> },
          r: { inner?: boolean },
        ): Promise<unknown> {
          if (!r.inner) return this.makeAdtRequest({ ...r, inner: true });
          wire += 1;
          return { status: 200 };
        },
      } as unknown as IAbapConnection;
      const recorder = recordRequests(reentrant);

      await withRequestTrace(recorder.connection).makeAdtRequest(request);

      expect(wire).toBe(1);
      expect(recorder.requests).toHaveLength(1);
    });
  });
});
