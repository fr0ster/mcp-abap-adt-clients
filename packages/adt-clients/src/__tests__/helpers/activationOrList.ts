/**
 * An activation the live suites expect to succeed, decided as a caller decides
 * it since adt-clients 49.0.0 (C7): the member sends the activation alone, so
 * a checklist that leaves the outcome to the inactive list — a re-activation
 * with nothing to do answers the silent one, measured on the cloud — is a
 * failure of `analyseActivation` without the list. The suite then reads the
 * list itself and decides by name: the activation stands when no listed
 * object carries a name its config names (its own, its parent's — a parent
 * still listed fails too, the safe side for a test).
 *
 * The full recipe, with the uris and the strategy, is `activationJudged.ts`;
 * this is the setup's coarser form, for handlers it holds without their code.
 */
import {
  analyseException,
  readUnstatedActivation,
  utilInactiveObjects,
} from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtUtils } from '../../core/shared/AdtUtils';
import { utilDocuments } from '../../core/shared/utilResultSet';
import { failureOf } from './contract';
import { createLibraryLogger } from './testLogger';

/** The names a config names: every `…Name` field but the package's. */
function namesOf(config: object): Set<string> {
  return new Set(
    Object.entries(config)
      .filter(
        ([key, value]) =>
          key.endsWith('Name') &&
          key !== 'packageName' &&
          typeof value === 'string',
      )
      .map(([, value]) => String(value).toUpperCase()),
  );
}

/**
 * Resolves when the activation answered a success, or answered a checklist
 * the inactive list decides and the list no longer names the object; throws
 * otherwise, with the failure's words.
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
  const utils = new AdtUtils(connection, {
    logger,
    results: { ...utilDocuments, inactive: utilInactiveObjects },
  });
  const listed = await utils.getInactiveObjects({ analyse: analyseException });
  if (!listed.ok) {
    throw new Error(
      failureOf(listed, `${what}: read the inactive list after the activation`),
    );
  }
  const names = namesOf(config);
  const still = listed
    .getResult()
    .value.objects.filter((o) => names.has(o.name.toUpperCase()));
  if (still.length > 0) {
    throw new Error(
      `${what}: SAP answered no verdict and the inactive list still names ${still
        .map((o) => `${o.type} ${o.name}`)
        .join(', ')}`,
    );
  }
}
