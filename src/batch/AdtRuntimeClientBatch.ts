import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtRuntimeClient } from '../clients/AdtRuntimeClient';
import { BatchRecordingConnection } from './BatchRecordingConnection';
import { buildBatchPayload } from './buildBatchPayload';
import { parseBatchResponse } from './parseBatchResponse';

export class AdtRuntimeClientBatch {
  private recorder: BatchRecordingConnection;
  private innerRuntime: AdtRuntimeClient;
  private realConnection: IAbapConnection;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.realConnection = connection;
    this.recorder = new BatchRecordingConnection(connection);
    this.innerRuntime = new AdtRuntimeClient(this.recorder, logger);
  }

  // Mirror relevant AdtRuntimeClient methods — consumers use the inner client
  // for recording, then call batchExecute() to flush.
  getInnerClient(): AdtRuntimeClient {
    return this.innerRuntime;
  }

  async batchExecute(): Promise<IAdtResponse[]> {
    const parts = this.recorder.getRecordedParts();
    if (parts.length === 0) {
      return [];
    }

    const payload = buildBatchPayload(parts);

    const response = await this.realConnection.makeAdtRequest({
      url: '/sap/bc/adt/debugger/batch',
      method: 'POST',
      timeout: 30000,
      data: payload.body,
      headers: {
        'Content-Type': `multipart/mixed; boundary=${payload.boundary}`,
        Accept: 'multipart/mixed',
      },
    });

    const contentType = String(response.headers?.['content-type'] ?? '');
    const parsed = parseBatchResponse(String(response.data), contentType);

    this.recorder.resolveAll(parsed);

    return parsed.map((p) => ({
      data: p.data,
      status: p.status,
      statusText: p.statusText,
      headers: p.headers,
    }));
  }

  reset(): void {
    this.recorder.reset();
  }

  getRecorder(): BatchRecordingConnection {
    return this.recorder;
  }
}
