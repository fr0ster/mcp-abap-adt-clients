/**
 * An activation the live suites expect to succeed, decided as a caller decides
 * it since adt-clients 49.0.0 (C7): the member sends the activation alone, so
 * a checklist that leaves the outcome to the inactive list — a re-activation
 * with nothing to do answers the silent one, measured on the cloud — is a
 * failure of `analyseActivation` without the list. The suite then reads the
 * list and hands it to `analyseActivation` with the uris the activation POST
 * named — the same judgement as `activationJudged.ts` and 48.0.0's member
 * (`stillInactiveAmong`: an object listed by `uri` or `parentUri`).
 *
 * The uris are taken from the POST itself: {@link watchActivations} records
 * them on the connection the handler sends through, so a handler held without
 * its code or name is judged by what it actually sent.
 */
import {
  analyseActivation,
  analyseException,
  readUnstatedActivation,
} from '@mcp-abap-adt/adt-strategies';
import {
  ADT_NO_FAILURE,
  type IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtUtils } from '../../core/shared/AdtUtils';
import { utilDocuments } from '../../core/shared/utilResultSet';
import { wireItself } from '../../utils/resultStrategy';
import { failureOf } from './contract';
import { createLibraryLogger } from './testLogger';

const ACTIVATION = '/sap/bc/adt/activation?';

/** The uris the last activation POST on each watched connection named. */
const named = new WeakMap<IAbapConnection, string[]>();
const watched = new WeakSet<IAbapConnection>();

/** The `adtcore:uri` of every reference a request body names, in order. */
function urisIn(body: unknown): string[] {
  if (typeof body !== 'string') return [];
  return body
    .split('adtcore:uri="')
    .slice(1)
    .map((rest) => rest.slice(0, rest.indexOf('"')));
}

/**
 * Record, on `connection`, the uris every `POST /sap/bc/adt/activation`
 * names. Idempotent; the request goes on as it came.
 */
export function watchActivations(
  connection: IAbapConnection | undefined,
): void {
  if (connection === undefined || watched.has(connection)) return;
  watched.add(connection);
  const base = connection.makeAdtRequest.bind(connection);
  connection.makeAdtRequest = (options: IAbapRequestOptions) => {
    if (options.method === 'POST' && options.url.startsWith(ACTIVATION)) {
      named.set(connection, urisIn(options.data));
    }
    return base(options);
  };
}

/**
 * Resolves when the activation answered a success, or answered a checklist
 * the inactive list decides and `analyseActivation`, given the list and the
 * uris the POST named, clears it; throws otherwise, with the failure's words.
 */
export async function expectActivated(
  answer: IAdtResponse<unknown>,
  connection: IAbapConnection,
  config: object,
  what: string,
  logger: ILogger = createLibraryLogger(),
): Promise<void> {
  if (answer.ok) return;
  const wire = answer.getError().response;
  if (wire === undefined || readUnstatedActivation(wire) === undefined) {
    throw new Error(failureOf(answer, what));
  }
  const uris = named.get(connection);
  if (uris === undefined || uris.length === 0) {
    throw new Error(
      `${what} (${JSON.stringify(config)}): the activation's outcome is the inactive list's to decide, and no activation POST was recorded on this connection (watchActivations)`,
    );
  }
  const utils = new AdtUtils(connection, {
    logger,
    results: { ...utilDocuments, inactive: wireItself },
  });
  const listed = await utils.getInactiveObjects({ analyse: analyseException });
  if (!listed.ok) {
    throw new Error(
      failureOf(
        listed,
        `${what}: the activation's outcome could not be decided, the inactive list could not be read`,
      ),
    );
  }
  const verdict = analyseActivation(ADT_NO_FAILURE, wire, {
    activation: { named: uris, inactiveObjects: listed.getResult().value },
  });
  if (verdict !== ADT_NO_FAILURE) {
    throw new Error(`${what}: ${verdict.message}`);
  }
}
