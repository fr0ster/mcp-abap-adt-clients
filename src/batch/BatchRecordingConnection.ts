import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces';
import type { IBatchRequestPart, IBatchResponsePart } from './types';

interface IDeferredResponse {
  resolve: (value: IAdtResponse) => void;
  reject: (reason: Error) => void;
}

export class BatchRecordingConnection implements IAbapConnection {
  private realConnection: IAbapConnection;
  private parts: IBatchRequestPart[] = [];
  private deferred: IDeferredResponse[] = [];

  constructor(realConnection: IAbapConnection) {
    this.realConnection = realConnection;
  }

  getBaseUrl(): Promise<string> {
    return this.realConnection.getBaseUrl();
  }

  getSessionId(): string | null {
    return this.realConnection.getSessionId();
  }

  setSessionType(_type: 'stateful' | 'stateless'): void {
    // no-op — session management is handled by the outer batch request
  }

  makeAdtRequest<T = any, D = any>(
    options: IAbapRequestOptions,
  ): Promise<IAdtResponse<T, D>> {
    const part: IBatchRequestPart = {
      method: options.method,
      url: options.url,
      headers: options.headers ?? {},
      data: options.data != null ? String(options.data) : undefined,
      params:
        options.params != null
          ? (options.params as Record<string, string>)
          : undefined,
    };

    this.parts.push(part);

    const promise = new Promise<IAdtResponse<T, D>>((resolve, reject) => {
      this.deferred.push({
        resolve: resolve as (value: IAdtResponse) => void,
        reject,
      });
    });

    return promise;
  }

  getRecordedParts(): IBatchRequestPart[] {
    return [...this.parts];
  }

  resolveAll(responses: IBatchResponsePart[]): void {
    if (responses.length !== this.deferred.length) {
      const error = new Error(
        `Batch response count (${responses.length}) does not match recorded request count (${this.deferred.length})`,
      );
      for (const d of this.deferred) {
        d.reject(error);
      }
      this.reset();
      return;
    }

    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i];
      const d = this.deferred[i];

      if (resp.status >= 400) {
        d.reject(
          new Error(
            `Batch part ${i} failed: ${resp.status} ${resp.statusText}`,
          ),
        );
      } else {
        d.resolve({
          data: resp.data,
          status: resp.status,
          statusText: resp.statusText,
          headers: resp.headers,
        });
      }
    }

    this.reset();
  }

  reset(): void {
    this.parts = [];
    this.deferred = [];
  }

  getRealConnection(): IAbapConnection {
    return this.realConnection;
  }
}
