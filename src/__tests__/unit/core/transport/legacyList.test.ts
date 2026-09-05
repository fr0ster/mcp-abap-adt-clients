/**
 * The legacy handler must use the legacy path.
 *
 * It inherited list() and therefore called /sap/bc/adt/cts on systems that do
 * not have it, while listTransportsLegacy() — written for exactly this — was
 * never called from anywhere.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtRequestLegacy } from '../../../../core/transport/AdtRequestLegacy';
import { expectFailure, expectResult } from '../../../helpers/contract';

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
      await new AdtRequestLegacy(connection).list(),
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

    expect(failure.message).toMatch(/not supported on legacy/);
    expect(calls).toHaveLength(0);
  });
});

describe('legacy transport update/delete', () => {
  it('refuses update() instead of inheriting the modern endpoint (zero requests)', async () => {
    const { connection, calls } = recordingConnection();

    const failure = expectFailure(
      await new AdtRequestLegacy(connection).update(),
      'legacy update',
    );

    expect(failure.message).toMatch(/not supported on legacy/);
    expect(calls).toHaveLength(0);
  });

  it('refuses delete() instead of inheriting the modern endpoint (zero requests)', async () => {
    const { connection, calls } = recordingConnection();

    const failure = expectFailure(
      await new AdtRequestLegacy(connection).delete(),
      'legacy delete',
    );

    expect(failure.message).toMatch(/not supported on legacy/);
    expect(calls).toHaveLength(0);
  });
});
