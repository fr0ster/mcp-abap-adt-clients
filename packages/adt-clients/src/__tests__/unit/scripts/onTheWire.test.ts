/**
 * `onTheWire` (the header probe's wire capture) wraps the connector's
 * `transport.send` and records the Accept and Content-Type of every request
 * that goes out there into the call that issued it. A connection without
 * that seam throws: before, it was handed back unchanged and the probe ran
 * recording nothing on the wire, with no sign of it.
 */

import type {
  IAdtTransport,
  IAdtTransportRequest,
} from '@mcp-abap-adt/connection';
import type {
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { onTheWire, runCalls } from '../../../../tools/header-probe/capture';
import { RecordingConnection } from '../../helpers/recordingConnection';

/** A recording connection that sends every request through its transport, as the connector does. */
class WiredConnection extends RecordingConnection {
  /** What reached the transport, in order. */
  readonly onTransport: IAdtTransportRequest[] = [];

  readonly transport: Pick<IAdtTransport, 'send'> = {
    send: async (request) => {
      this.onTransport.push(request);
      return { status: 200, headers: {}, data: '' };
    },
  };

  override async makeAdtRequest<T = unknown, D = unknown>(
    options: IAbapRequestOptions,
  ): Promise<IAdtWireResponse<T, D>> {
    await this.transport.send({
      method: options.method,
      url: options.url,
      headers: { ...options.headers, 'Content-Type': 'text/plain' },
    });
    return super.makeAdtRequest<T, D>(options);
  }
}

describe('onTheWire', () => {
  it('throws on a connection without the transport seam', () => {
    expect(() => onTheWire(new RecordingConnection())).toThrow(
      /no transport seam/,
    );
  });

  it('records what went out on the transport into the call that sent it', async () => {
    const connection = onTheWire(new WiredConnection());

    const captures = await runCalls<WiredConnection>({
      calls: [
        (target) =>
          target.makeAdtRequest({
            url: '/sap/bc/adt/x',
            method: 'GET',
            timeout: 0,
            headers: { Accept: 'application/xml' },
          }),
        (target) =>
          target.makeAdtRequest({
            url: '/sap/bc/adt/y',
            method: 'GET',
            timeout: 0,
            headers: { 'x-csrf-token': 'Fetch' },
          }),
      ],
      batched: false,
      connection,
      direct: connection,
      onBatch: () => connection,
    });

    expect(connection.onTransport.map((r) => r.url)).toEqual([
      '/sap/bc/adt/x',
      '/sap/bc/adt/y',
    ]);
    expect(captures[0]?.onWire).toEqual([
      { accept: 'application/xml', contentType: 'text/plain' },
    ]);
    // A CSRF token fetch is left out.
    expect(captures[1]?.onWire).toBeUndefined();
  });
});
