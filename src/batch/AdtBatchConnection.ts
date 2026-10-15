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

/** Records member requests; execute also drains requests queued during settlement. */
export class AdtBatchConnection implements IAbapConnection {
  private queue: Pending[] = [];
  private session: Session;
  private readonly defaultSession: Session;
  private settlementFailure?: { error: unknown };
  private executing = false;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly options: {
      endpoint: 'communication' | 'debugger';
      logger?: ILogger;
    },
  ) {
    this.defaultSession = this.wrappedSession();
    this.session = this.defaultSession;
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
    if (this.settlementFailure)
      return Promise.reject(this.settlementFailure.error);
    const headers = { ...request.headers };
    const stateful =
      this.session === 'stateful' ||
      Object.entries(headers).some(
        ([key, value]) =>
          key.toLowerCase() === 'x-sap-adt-sessiontype' && value === 'stateful',
      );
    // Members restore their mode only after the deferred answer. Scope an
    // explicit switch to this recording so neighbouring members cannot inherit it.
    this.session = this.defaultSession;
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
    let active: Pending[] = [];
    try {
      let response: IAdtWireResponse;
      for (let envelope = 0; ; envelope++) {
        if (envelope === 100)
          throw new Error('ADT batch exceeded 100 settlement envelopes');
        const nextMode = pending.findIndex(
          (part) => part.stateful !== pending[0].stateful,
        );
        active = pending.splice(0, nextMode < 0 ? pending.length : nextMode);
        const payload = buildBatchPayload(
          active.map((part) => innerRequest(part.request)),
        );
        this.connection.setSessionType(
          active[0].stateful ? 'stateful' : 'stateless',
        );
        this.options.logger?.debug('Executing ADT batch', {
          endpoint: this.options.endpoint,
          parts: active.length,
        });
        response = await this.connection.makeAdtRequest({
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
        for (const [index, part] of active.entries()) {
          const answer = parts[index];
          if (!answer)
            part.reject(
              new Error(
                `ADT batch response part count mismatch: expected ${active.length}, received ${parts.length}; missing part ${index + 1}`,
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
        if (parts.length !== active.length)
          throw new Error(
            `ADT batch response part count mismatch: expected ${active.length}, received ${parts.length}`,
          );
        active = [];
        // Let negotiation and member continuations record their follow-up calls.
        await new Promise<void>((resolve) => setImmediate(resolve));
        pending.push(...this.queue.splice(0));
        if (!pending.length) return response;
      }
    } catch (error) {
      const unsentError = new Error(
        'ADT batch request not sent because an earlier batch envelope failed',
        { cause: error },
      );
      this.settlementFailure = { error: unsentError };
      for (const part of active) part.reject(error);
      for (const part of pending) part.reject(unsentError);
      await new Promise<void>((resolve) => setImmediate(resolve));
      for (const part of this.queue.splice(0)) part.reject(unsentError);
      await new Promise<void>((resolve) => setImmediate(resolve));
      throw error;
    } finally {
      this.connection.setSessionType(previous);
      this.executing = false;
      this.settlementFailure = undefined;
    }
  }
}
