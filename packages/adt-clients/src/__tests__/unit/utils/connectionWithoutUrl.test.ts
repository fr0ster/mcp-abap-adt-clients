/**
 * A connection without an HTTP origin (RFC): `getBaseUrl()` answers
 * `undefined` (interfaces-adt-connection 4). What the library does with that
 * answer is pinned here: the batch connection hands it on as it is, and the
 * cloud probe goes to its `systeminformation` fallback instead of reading the
 * absence as on-premise.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtBatchConnection } from '../../../batch';
import { isCloudEnvironment } from '../../../utils/systemInfo';

/** An RFC-like connection: no URL, every request refused with `status`. */
class ConnectionWithoutUrl implements IAbapConnection {
  readonly requests: IAbapRequestOptions[] = [];
  constructor(private readonly status: number) {}
  async connect(): Promise<void> {}
  async getBaseUrl(): Promise<string | undefined> {
    return undefined;
  }
  getSessionId(): string | null {
    return null;
  }
  setSessionType(_type: 'stateful' | 'stateless'): void {}
  makeAdtRequest<T = unknown, D = unknown>(
    options: IAbapRequestOptions,
  ): Promise<IAdtWireResponse<T, D>> {
    this.requests.push(options);
    // The answer is a refusal with the status the case names, as a
    // connection raises a non-2xx answer.
    return Promise.reject(
      Object.assign(new Error(`HTTP ${this.status}`), {
        response: { status: this.status, headers: {}, data: '' },
      }),
    );
  }
}

describe('a connection without a URL', () => {
  it('AdtBatchConnection forwards undefined as it is', async () => {
    const batch = new AdtBatchConnection(new ConnectionWithoutUrl(404), {
      endpoint: 'communication',
    });
    expect(await batch.getBaseUrl()).toBeUndefined();
  });

  it('isCloudEnvironment asks systeminformation: a 404 is on-premise', async () => {
    const connection = new ConnectionWithoutUrl(404);
    await expect(isCloudEnvironment(connection)).resolves.toBe(false);
    expect(connection.requests.map((request) => request.url)).toEqual([
      '/sap/bc/adt/core/http/systeminformation',
    ]);
  });

  it('isCloudEnvironment raises a failed systeminformation, never reads the absence as on-premise', async () => {
    const connection = new ConnectionWithoutUrl(500);
    await expect(isCloudEnvironment(connection)).rejects.toThrow();
    expect(connection.requests).toHaveLength(1);
  });
});
