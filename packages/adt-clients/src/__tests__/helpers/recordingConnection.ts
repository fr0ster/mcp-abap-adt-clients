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
