import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { BATCH } from '../endpoints/objects';
import { buildBatchPayload, innerRequest, parseBatchResponse } from './wire';

type Session = 'stateful' | 'stateless';
interface Pending {
  request: IAbapRequestOptions;
  stateful: boolean;
  resolve: (response: IAdtWireResponse) => void;
  reject: (error: unknown) => void;
}

/** Records member requests; execute sends the current queue in one envelope. */
export class AdtBatchConnection implements IAbapConnection {
  private queue: Pending[] = [];
  private session: Session;
  private executing = false;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly options: {
      endpoint: 'communication' | 'debugger';
      logger?: ILogger;
    },
  ) {
    this.session = this.wrappedSession();
  }
  private wrappedSession(): Session {
    const connection = this.connection as IAbapConnection & {
      getSessionType?: () => Session;
      getSessionMode?: () => Session;
    };
    return (
      connection.getSessionType?.() ??
      connection.getSessionMode?.() ??
      'stateless'
    );
  }
  connect(): Promise<void> {
    return this.connection.connect();
  }
  getBaseUrl(): Promise<string> {
    return this.connection.getBaseUrl();
  }
  getSessionId(): string | null {
    return this.connection.getSessionId();
  }
  setSessionType(type: Session): void {
    this.session = type;
  }
  getSessionType(): Session {
    return this.session;
  }
  makeAdtRequest<T = unknown, D = unknown>(
    request: IAbapRequestOptions,
  ): Promise<IAdtWireResponse<T, D>> {
    const headers = { ...request.headers };
    const stateful = this.session === 'stateful';
    if (stateful) headers['X-sap-adt-sessiontype'] = 'stateful';
    return new Promise<IAdtWireResponse>((resolve, reject) => {
      this.queue.push({
        request: { ...request, headers },
        stateful,
        resolve,
        reject,
      });
    }) as Promise<IAdtWireResponse<T, D>>;
  }
  /** Empty queues return a synthetic 204, data '', without network traffic. */
  async execute(): Promise<IAdtWireResponse> {
    if (this.executing)
      throw new Error('An ADT batch execute is already in progress');
    const pending = this.queue;
    this.queue = [];
    if (!pending.length)
      return { status: 204, statusText: 'Empty batch', headers: {}, data: '' };
    this.executing = true;
    const previous = this.wrappedSession();
    try {
      const payload = buildBatchPayload(
        pending.map((part) => innerRequest(part.request)),
      );
      this.connection.setSessionType(
        pending.some((part) => part.stateful) ? 'stateful' : 'stateless',
      );
      this.options.logger?.debug('Executing ADT batch', {
        endpoint: this.options.endpoint,
        parts: pending.length,
      });
      const response = await this.connection.makeAdtRequest({
        url: BATCH[this.options.endpoint],
        method: 'POST',
        timeout: 0,
        data: payload.body,
        headers: {
          'Content-Type': `multipart/mixed; boundary=${payload.boundary}`,
          Accept: 'multipart/mixed',
        },
      });
      const parts = parseBatchResponse(response);
      for (const [index, part] of pending.entries()) {
        const answer = parts[index];
        if (!answer)
          part.reject(
            new Error(
              `ADT batch response part count mismatch: expected ${pending.length}, received ${parts.length}; missing part ${index + 1}`,
            ),
          );
        else if (answer.status >= 200 && answer.status < 300)
          part.resolve(answer);
        else
          part.reject(
            Object.assign(
              new Error(`Request failed with status code ${answer.status}`),
              { response: answer },
            ),
          );
      }
      if (parts.length !== pending.length)
        throw new Error(
          `ADT batch response part count mismatch: expected ${pending.length}, received ${parts.length}`,
        );
      return response;
    } catch (error) {
      for (const part of pending) part.reject(error);
      throw error;
    } finally {
      this.connection.setSessionType(previous);
      this.executing = false;
    }
  }
}
