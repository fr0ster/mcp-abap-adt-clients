/**
 * The legacy handler must use the legacy path.
 *
 * It inherited list() and therefore called /sap/bc/adt/cts on systems that do
 * not have it, while listTransportsLegacy() — written for exactly this — was
 * never called from anywhere.
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  expectFailure,
  expectResult,
} from '../../../../../../adt-clients/src/__tests__/helpers/contract';
import { transportParsing } from '../../../../../../adt-clients/src/__tests__/helpers/transportParsing';
import { AdtRequestLegacy } from '../../../../core/transport/AdtRequestLegacy';

const recordingConnection = () => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return {
        data: '<tm:root/>',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
};

describe('legacy transport list', () => {
  it('calls the legacy CTS path, not the ADT one', async () => {
    const { connection, calls } = recordingConnection();

    const tree = expectResult(
      await new AdtRequestLegacy(
        connection,
        undefined,
        undefined,
        transportParsing,
      ).list(),
      'legacy list',
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/sap/bc/cts/transportrequests');
    // `<tm:root/>` is an empty list, and an empty list is an answer.
    expect(tree.requests).toEqual([]);
  });

  it('refuses configUri instead of silently ignoring it', async () => {
    const { connection, calls } = recordingConnection();

    const failure = expectFailure(
      await new AdtRequestLegacy(connection).list({ configUri: '/x' }),
      'legacy list with configUri',
    );

    expect(failure.message).toMatch(
      /not supported on a legacy system \(7\.40 SP04\)/,
    );
    expect(calls).toHaveLength(0);
  });
});

describe('legacy transport update/delete', () => {
  it('refuses update() instead of inheriting the modern endpoint (zero requests)', async () => {
    const { connection, calls } = recordingConnection();

    const failure = expectFailure(
      await new AdtRequestLegacy(connection).updateMetadata(),
      'legacy update',
    );

    expect(failure.message).toMatch(
      /not supported on a legacy system \(7\.40 SP04\)/,
    );
    expect(calls).toHaveLength(0);
  });

  it('refuses delete() instead of inheriting the modern endpoint (zero requests)', async () => {
    const { connection, calls } = recordingConnection();

    const failure = expectFailure(
      await new AdtRequestLegacy(connection).delete(),
      'legacy delete',
    );

    expect(failure.message).toMatch(
      /not supported on a legacy system \(7\.40 SP04\)/,
    );
    expect(calls).toHaveLength(0);
  });
});

describe('legacy transport members', () => {
  const cfg = { transportNumber: 'GUARD_REQUEST' };
  const entry = { type: 'PROG', name: 'ZGUARD', position: '1' };
  const headers = { headers: {} as IAdtHeaders };
  type Handler = AdtRequestLegacy;
  const refused: [string, (h: Handler) => Promise<unknown>][] = [
    // @ts-expect-error -- 7.40 does not serve request.searchConfigurations; the refusal is for a caller outside the type system
    ['searchConfigurations', (h) => h.searchConfigurations()],
    // @ts-expect-error -- 7.40 does not serve request.deletionCheck; the refusal is for a caller outside the type system
    ['checkDeletion', (h) => h.checkDeletion(cfg, headers)],
    // @ts-expect-error -- 7.40 does not serve request.readObjects; the refusal is for a caller outside the type system
    ['readObjects', (h) => h.readObjects('GUARD_REQUEST')],
    // @ts-expect-error -- 7.40 does not serve request.readActionLog; the refusal is for a caller outside the type system
    ['readActionLog', (h) => h.readActionLog('GUARD_REQUEST')],
    // @ts-expect-error -- 7.40 does not serve request.addObject; the refusal is for a caller outside the type system
    ['addObject', (h) => h.addObject('GUARD_REQUEST', entry, headers)],
    // @ts-expect-error -- 7.40 does not serve request.removeObject; the refusal is for a caller outside the type system
    ['removeObject', (h) => h.removeObject('GUARD_REQUEST', entry, headers)],
    [
      'moveObjects',
      // @ts-expect-error -- 7.40 does not serve request.moveObjects; the refusal is for a caller outside the type system
      (h) => h.moveObjects('GUARD_TASK', 'GUARD_REQUEST', [entry], headers),
    ],
    // @ts-expect-error -- 7.40 does not serve request.sortAndCompress; the refusal is for a caller outside the type system
    ['sortAndCompress', (h) => h.sortAndCompress('GUARD_TASK')],
    [
      'createTask',
      // @ts-expect-error -- 7.40 does not serve request.createTask; the refusal is for a caller outside the type system
      (h) => h.createTask('GUARD_REQUEST', { ...headers, targetUser: 'GUARD' }),
    ],
    [
      'changeTaskType',
      // @ts-expect-error -- 7.40 does not serve request.changeTaskType; the refusal is for a caller outside the type system
      (h) => h.changeTaskType('GUARD_TASK', 'Unclassified' as never, headers),
    ],
    ['create', (h) => h.create()],
    ['updateMetadata', (h) => h.updateMetadata()],
    ['delete', (h) => h.delete()],
  ];

  it.each(refused)('%s refuses without a request', async (_member, call) => {
    const { connection, calls } = recordingConnection();

    const failure = expectFailure(
      (await call(new AdtRequestLegacy(connection))) as Parameters<
        typeof expectFailure
      >[0],
      'legacy transport member',
    );

    expect(failure.message).toMatch(
      /not supported on a legacy system \(7\.40 SP04\)/,
    );
    expect(calls).toHaveLength(0);
  });

  it('list and readMetadata send one GET to the legacy collection', async () => {
    for (const call of [
      (h: AdtRequestLegacy<typeof transportParsing>) => h.list(),
      (h: AdtRequestLegacy<typeof transportParsing>) => h.readMetadata(cfg),
    ]) {
      const { connection, calls } = recordingConnection();
      await call(
        new AdtRequestLegacy(
          connection,
          undefined,
          undefined,
          transportParsing,
        ),
      );
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('GET');
      expect(calls[0].url).toBe('/sap/bc/cts/transportrequests');
    }
  });
});
