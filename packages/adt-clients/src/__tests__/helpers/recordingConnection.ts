/**
 * A connection that records every request a member sends and answers each
 * `200 OK` with an empty body — typed as the contract it implements, every
 * member of `IAbapConnection` written out, so no cast of the whole object is
 * needed to hand it to a handler.
 */

import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';

export class RecordingConnection implements IAbapConnection {
  /** Every request, in the order it was sent. */
  readonly sent: IAbapRequestOptions[] = [];

  async connect(): Promise<void> {}

  async getBaseUrl(): Promise<string> {
    return '';
  }

  getSessionId(): string | null {
    return null;
  }

  setSessionType(): void {}

  async makeAdtRequest<T = unknown, D = unknown>(
    options: IAbapRequestOptions,
  ): Promise<IAdtWireResponse<T, D>> {
    this.sent.push(options);
    // `T` is the caller's to name and the empty body is no value of every
    // `T`: the one assertion the contract's generic answer leaves a fake.
    return { status: 200, statusText: 'OK', headers: {}, data: '' as T };
  }
}

/**
 * A recording connection that also offers the connector's critical section
 * (`beginCriticalSection` / `endCriticalSection`, which `AbstractAbapConnection`
 * of `@mcp-abap-adt/connection` has and `IAbapConnection` does not declare),
 * and answers each request with the body `bodyFor` gives — or throws what it
 * throws. Every request and every begin and end goes into `events`, in order.
 */
export class CriticalSectionConnection extends RecordingConnection {
  /** `begin`, `end` and `<METHOD> <url>`, in the order they happened. */
  readonly events: string[] = [];

  constructor(
    private readonly bodyFor: (options: IAbapRequestOptions) => string = () =>
      '',
  ) {
    super();
  }

  beginCriticalSection(): void {
    this.events.push('begin');
  }

  endCriticalSection(): void {
    this.events.push('end');
  }

  override async makeAdtRequest<T = unknown, D = unknown>(
    options: IAbapRequestOptions,
  ): Promise<IAdtWireResponse<T, D>> {
    this.events.push(`${options.method} ${options.url}`);
    const answer = await super.makeAdtRequest<T, D>(options);
    // As in the base: `T` is the caller's, and the body is text.
    return { ...answer, data: this.bodyFor(options) as T };
  }
}
