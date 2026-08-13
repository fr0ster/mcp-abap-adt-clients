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
  IAdtResponse,
} from '@mcp-abap-adt/interfaces';
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
      } as unknown as IAdtResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
};

describe('legacy transport list', () => {
  it('calls the legacy CTS path, not the ADT one', async () => {
    const { connection, calls } = recordingConnection();

    const state = await new AdtRequestLegacy(connection).list();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/sap/bc/cts/transportrequests');
    expect(state.listResult).toBeDefined();
    expect(state.errors).toEqual([]);
  });

  it('rejects configUri instead of silently ignoring it', async () => {
    const { connection, calls } = recordingConnection();

    await expect(
      new AdtRequestLegacy(connection).list({ configUri: '/x' }),
    ).rejects.toThrow(/not supported on legacy/);
    expect(calls).toHaveLength(0);
  });
});
