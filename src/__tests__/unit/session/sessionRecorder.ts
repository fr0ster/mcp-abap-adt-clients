/**
 * Session-mode recorder: a fake IAbapConnection that records, for every ADT
 * request, which session mode was active when that request went out.
 *
 * Why this exists: a stateful ADT session dies when a request leaves the client
 * without the stateful marker (or when the session identity is swapped under
 * our feet). Both are client-side facts — they are decided by our chain code
 * before any byte reaches SAP, so they can be proven without a SAP system.
 *
 * The recorder deliberately does NOT model SAP semantics (it never rejects a
 * lock handle). It only answers: in which session mode did each request leave?
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';

export type SessionMode = 'stateful' | 'stateless';

export interface RecordedCall {
  /** 0-based position in the request sequence. */
  index: number;
  method: string;
  url: string;
  /** Session mode active at the moment the request was issued. */
  mode: SessionMode;
}

export interface SessionRecorder {
  conn: IAbapConnection;
  calls: RecordedCall[];
  /** Session mode currently set on the connection. */
  readonly mode: SessionMode;
  /** Requests carrying `_action=LOCK` … `_action=UNLOCK`, both inclusive. */
  lockWindow(): RecordedCall[];
  urls(): string[];
}

const lockXml = (handle: string): string =>
  `<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>${handle}</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

/** Empty report — parseCheckRunResponse reads it as "no errors". */
const CHECKRUN_OK =
  '<chkrun:checkRunReports xmlns:chkrun="http://www.sap.com/adt/checkrun"/>';

const ok = (data: unknown): IAdtResponse =>
  ({ data, status: 200, statusText: 'OK', headers: {} }) as IAdtResponse;

/**
 * @param respond Optional override consulted before the default responses;
 *   return undefined to fall through. Use it to inject errors at a chosen step.
 * @param lockHandle Handle handed out by LOCK requests.
 */
export function createSessionRecorder(
  respond?: (options: {
    url: string;
    method: string;
    index: number;
  }) => IAdtResponse | undefined,
  lockHandle = 'LH-1',
): SessionRecorder {
  let mode: SessionMode = 'stateless';
  const calls: RecordedCall[] = [];

  const conn = {
    connect: async () => undefined,
    getBaseUrl: async () => 'http://stub.invalid',
    getSessionId: () => 'STUB-SESSION',
    setSessionType: (type: SessionMode) => {
      mode = type;
    },
    // Loose shape on purpose: the fake mirrors what handlers actually pass.
    makeAdtRequest: async (options: any): Promise<IAdtResponse> => {
      const url = String(options.url);
      const method = String(options.method ?? 'GET').toUpperCase();
      const index = calls.length;
      calls.push({ index, method, url, mode });

      const override = respond?.({ url, method, index });
      if (override) {
        return override;
      }

      if (url.includes('_action=LOCK')) {
        return ok(lockXml(lockHandle));
      }
      if (url.includes('/checkruns')) {
        return ok(CHECKRUN_OK);
      }
      return ok('');
    },
  } as unknown as IAbapConnection;

  return {
    conn,
    calls,
    get mode() {
      return mode;
    },
    urls: () => calls.map((c) => `${c.method} ${c.url}`),
    lockWindow() {
      const start = calls.findIndex((c) => c.url.includes('_action=LOCK'));
      if (start === -1) {
        return [];
      }
      const end = calls.findIndex((c) => c.url.includes('_action=UNLOCK'));
      return calls.slice(start, end === -1 ? calls.length : end + 1);
    },
  };
}
