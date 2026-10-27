/**
 * Shared system information utilities
 */

import type {
  AdtNoFailure,
  IAdtAnalyseOptions,
  IAdtContentTypes,
  IAdtError,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  AdtContentTypesBase,
  AdtContentTypesModern,
} from '../core/shared/contentTypes';
import {
  failed,
  isUnansweredCredentialRefusal,
  recogniseFailure,
  succeeded,
} from './adtResponse';

/**
 * Whether a failure says the endpoint is not there — the one failure
 * `isModernAdtSystem` answers rather than raises.
 *
 * 404, 405 and 501 are a system without the resource. Anything else — no
 * network, an expired session, a 401, a 500 — is not an answer about the
 * system, and until 23.0.0 it was swallowed into the same `false`/`null`, so a
 * modern system reached over a broken connection was handed a legacy client.
 */
function endpointAbsent(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return status === 404 || status === 405 || status === 501;
}

const SYSTEM_INFORMATION_URL = '/sap/bc/adt/core/http/systeminformation';

/** The record `systeminformation` answers, each field read only as a string. */
type SystemInformationRecord = {
  systemID?: string;
  userName?: string;
  client?: string;
  language?: string;
  userFullName?: string;
};

/** The body as a plain JSON object, else `undefined`. */
function objectOf(data: unknown): Record<string, unknown> | undefined {
  let value = data;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function recordOf(
  body: Record<string, unknown> | undefined,
): SystemInformationRecord {
  const text = (name: string): string | undefined => {
    const value = body?.[name];
    return typeof value === 'string' ? value : undefined;
  };
  return {
    systemID: text('systemID'),
    userName: text('userName'),
    userFullName: text('userFullName'),
    client: text('client'),
    language: text('language'),
  };
}

const isSuccessStatus = (status: number) => status >= 200 && status <= 299;

/**
 * The system's own record, from `/sap/bc/adt/core/http/systeminformation`.
 *
 * Three answers, kept apart, because a caller acts differently on each:
 *
 * - **present** — a `2xx` whose body is a JSON object: `{ present: true, info }`,
 *   each field read only when it is a string;
 * - **absent** — a `404`: the system has no such endpoint (an on-premise
 *   system without it), `{ present: false }`. Only a `404`: it is what
 *   the MCP server's own `systeminformation` reader takes as the endpoint
 *   absent on premise, and no other status has been seen for it. A `405` or `501` is a failure like
 *   any other status;
 * - **a failure** — any other status, no answer at all, or a `2xx` whose body
 *   is no JSON object (a logon page a proxy answered with, an empty body):
 *   `ok: false`, with the response and the request. A malformed `2xx` is
 *   `origin: 'connection'` — no usable answer came back.
 *
 * The verdict goes through `options.analyse` like any member's: it receives
 * the library's verdict (`ADT_NO_FAILURE` for a `404` and for a readable
 * `2xx`) and the response. It may name a failure — a `404` on a system that
 * must have the endpoint — or clear one: a cleared `2xx` is a record naming
 * nothing, a cleared other status is the endpoint absent (a `405`/`501` read
 * as absent, as 23.0.0–36.x did), and a failure with no response cannot be
 * cleared. A connection that hands back a status other than a `2xx` instead
 * of throwing it is read by that status the same way.
 *
 * A credential refusal SAP was never asked about is thrown as it came, as by
 * every member.
 */
export async function getSystemInformation<E extends IAdtError = IAdtError>(
  connection: IAbapConnection,
  options?: IAdtAnalyseOptions<E>,
): Promise<
  IAdtResponse<
    { present: true; info: SystemInformationRecord } | { present: false },
    E
  >
> {
  const request = { method: 'GET', url: SYSTEM_INFORMATION_URL };
  let wire: IAdtWireResponse | undefined;
  let verdict: IAdtError | AdtNoFailure = ADT_NO_FAILURE;

  try {
    wire = await connection.makeAdtRequest({
      url: SYSTEM_INFORMATION_URL,
      method: 'GET',
      timeout: 0,
      headers: {
        Accept: 'application/vnd.sap.adt.core.http.systeminformation.v1+json',
      },
      // Cache busting, as Eclipse sends it.
      params: { _: Date.now() },
    });
  } catch (error: unknown) {
    if (isUnansweredCredentialRefusal(error)) throw error;
    wire = (error as { response?: IAdtWireResponse })?.response;
    if (wire?.status !== 404) {
      const recognised = recogniseFailure(error);
      verdict = { ...recognised, request: recognised.request ?? request };
    }
  }

  let body: Record<string, unknown> | undefined;
  if (wire && verdict === ADT_NO_FAILURE && wire.status !== 404) {
    if (!isSuccessStatus(wire.status)) {
      verdict = {
        origin: 'connection',
        message: `systeminformation answered ${wire.status}`,
        response: wire,
        request,
      };
    } else {
      body = objectOf(wire.data);
      if (!body) {
        verdict = {
          origin: 'connection',
          message: `systeminformation answered ${wire.status} with a body that is not a JSON object`,
          response: wire,
          request,
        };
      }
    }
  }

  // `E` is given a value only by `analyse`; without one the verdict is the
  // library's own `IAdtError`, which is `E`'s default — as in `answering`.
  const analyse = options?.analyse;
  if (analyse) {
    const overruled = analyse(verdict, wire);
    if (overruled !== ADT_NO_FAILURE) return failed(overruled);
  } else if (verdict !== ADT_NO_FAILURE) {
    return failed(verdict as E);
  }

  if (!wire) {
    return failed(
      (verdict === ADT_NO_FAILURE
        ? {
            origin: 'connection',
            message: 'The request did not complete, and carried no answer',
            request,
          }
        : verdict) as E,
    );
  }
  if (!isSuccessStatus(wire.status)) return succeeded({ present: false });
  return succeeded({ present: true, info: recordOf(body) });
}

/**
 * Check if the system is a BTP ABAP Cloud Environment
 *
 * Detection strategy (ordered by reliability):
 * 1. URL pattern — cloud systems use *.hana.ondemand.com or *.abap.*.hana.ondemand.com
 * 2. HTTP with explicit port — almost always on-premise
 * 3. Fallback to systeminformation endpoint check
 */
export async function isCloudEnvironment(
  connection: IAbapConnection,
): Promise<boolean> {
  try {
    const baseUrl = await connection.getBaseUrl();
    if (baseUrl) {
      // Cloud systems use specific domain patterns
      if (/\.hana\.ondemand\.com/i.test(baseUrl)) {
        return true;
      }
      // HTTP with explicit port is typically on-premise
      try {
        const parsed = new URL(baseUrl);
        if (parsed.protocol === 'http:' && parsed.port) {
          return false;
        }
      } catch {
        // URL parsing failed — continue to fallback
      }
    }
  } catch {
    // getBaseUrl() failed — continue to fallback
  }

  // Fallback: whether the systeminformation endpoint answers. Its failure —
  // another status, no answer, a body that is not its record — says nothing
  // about the system and is raised, never read as on-premise.
  const answer = await getSystemInformation(connection);
  if (!answer.ok) {
    const failure = answer.getError();
    throw Object.assign(new Error(failure.message), { failure });
  }
  return answer.getResult().value.present;
}

/**
 * Check if the system supports modern ADT endpoints (core/discovery).
 *
 * Modern systems (S/4 HANA, BTP) expose /sap/bc/adt/core/discovery.
 * Older systems (BASIS 7.40 and below) only have /sap/bc/adt/discovery.
 */
export async function isModernAdtSystem(
  connection: IAbapConnection,
): Promise<boolean> {
  try {
    const response = await connection.makeAdtRequest({
      url: '/sap/bc/adt/core/discovery',
      method: 'GET',
      timeout: 0,
      headers: {
        Accept: 'application/atomsvc+xml',
      },
    });
    // Modern systems return XML with content-length > 0
    const contentType = String(response.headers?.['content-type'] || '');
    return contentType.includes('xml');
  } catch (error) {
    // No core/discovery is a legacy system. Any other failure says nothing
    // about which system this is, and is raised rather than read as "legacy".
    if (endpointAbsent(error)) return false;
    throw error;
  }
}

/**
 * Resolve the appropriate content types for the connected SAP system.
 *
 * Uses /sap/bc/adt/core/discovery to detect modern systems:
 * - Available → AdtContentTypesModern (v2+ headers)
 * - Not available → AdtContentTypesBase (v1 headers, universal)
 */
export async function resolveContentTypes(
  connection: IAbapConnection,
): Promise<IAdtContentTypes> {
  const isModern = await isModernAdtSystem(connection);
  return isModern ? new AdtContentTypesModern() : new AdtContentTypesBase();
}
