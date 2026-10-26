/**
 * A connection that records what leaves it, for a live test.
 *
 * "Sends nothing" is asserted on what this recorded, never on a log line: a
 * log proves only what someone chose to log. Each request is kept as the
 * library handed it to the connection — method, URL, params, body, headers —
 * with the status it was answered with (the status of a failed request is
 * read off the error's `response`, and the error is rethrown as it came).
 * `setSessionType` calls are recorded too, then forwarded. Every other member
 * is the connection's own, called on the connection itself.
 *
 * **A write through the recorder stays on the recorder.** Every client wraps
 * the connection it is given by assigning `makeAdtRequest` on it
 * (`withRequestTrace`). Without a `set` trap that assignment would land on the
 * wrapped connection: the next read of `makeAdtRequest` would then wrap the
 * client's wrapper, which calls the recorder captured before it — two entries
 * for one request — and a second recorder on the same connection (a deny one)
 * would install its own wrapper on the connection every other client shares.
 * So a property set through the recorder is kept here, read back as set, and
 * the connection is never written.
 *
 * **Deny mode** (`{ deny: true }`) is for a check that nothing is sent: a
 * request is recorded and then refused with an error, never forwarded, so a
 * member that regressed into sending cannot reach the system.
 */

import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';

export interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly params?: unknown;
  readonly data?: unknown;
  readonly headers?: Record<string, string>;
  /** The answer's status; absent when none came back. */
  status?: number;
  /** The answer's body, kept only with `RecordOptions.keepAnswers`. */
  answer?: unknown;
}

export interface RequestRecorder<T extends IAbapConnection> {
  /** The recording connection: hand this to the client. */
  readonly connection: T;
  readonly requests: RecordedRequest[];
  readonly sessionTypes: string[];
}

function statusOf(value: unknown): number | undefined {
  const status = (value as { status?: unknown } | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}

export interface RecordOptions {
  /** Record each request, then throw instead of forwarding it. */
  readonly deny?: boolean;
  /**
   * Keep each answer's body on its entry (`answer`), for a check that ties a
   * later request to what an earlier one answered — a lock's handle.
   */
  readonly keepAnswers?: boolean;
}

export function recordRequests<T extends IAbapConnection>(
  connection: T,
  options: RecordOptions = {},
): RequestRecorder<T> {
  const requests: RecordedRequest[] = [];
  const sessionTypes: string[] = [];
  /** What was written through the recorder, kept off the connection. */
  const written = new Map<PropertyKey, unknown>();
  const recording = new Proxy(connection, {
    set(_target, property, value) {
      written.set(property, value);
      return true;
    },
    get(target, property) {
      if (written.has(property)) return written.get(property);
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      if (property === 'makeAdtRequest') {
        return async (request: IAbapRequestOptions) => {
          const entry: RecordedRequest = {
            method: request.method,
            url: request.url,
            ...(request.params !== undefined && { params: request.params }),
            ...(request.data !== undefined && { data: request.data }),
            ...(request.headers !== undefined && { headers: request.headers }),
          };
          requests.push(entry);
          if (options.deny)
            throw new Error(
              `request denied by the recorder: ${request.method} ${request.url}`,
            );
          try {
            const answer = await value.call(target, request);
            entry.status = statusOf(answer);
            if (options.keepAnswers)
              entry.answer = (answer as { data?: unknown } | undefined)?.data;
            return answer;
          } catch (error) {
            const status = statusOf(
              (error as { response?: unknown } | undefined)?.response,
            );
            if (status !== undefined) entry.status = status;
            throw error;
          }
        };
      }
      if (property === 'setSessionType') {
        return (type: string) => {
          sessionTypes.push(type);
          return value.call(target, type);
        };
      }
      return value.bind(target);
    },
  });
  return { connection: recording, requests, sessionTypes };
}
