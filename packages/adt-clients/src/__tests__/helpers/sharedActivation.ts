/**
 * Activate shared objects that name each other in one group run, and fail on
 * anything short of an activation that happened.
 *
 * The shared objects marked `skip_activation: true` in `shared_dependencies`
 * are written inactive by `ensureSharedDependency`; this is the step that
 * activates them. An AMDP class and the table function it implements are the
 * case: neither activates alone.
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import {
  ADT_NO_FAILURE,
  type AdtTypeCode,
  type IAdtError,
  type IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtUtils } from '../../core/shared/AdtUtils';
import { utilDocuments } from '../../core/shared/utilResultSet';
import { wireItself } from '../../utils/resultStrategy';
import { integrationHeadersOf } from './adtHeaders';
import { expectResult } from './contract';
import { judged } from './judged';
import {
  attributeOf,
  attributeValues,
  elementsNamed,
  parseXmlDocument,
  textOf,
} from './xmlTree';

export interface ISharedGroupMember {
  /** The ADT type, e.g. `DDLS/DF`, `CLAS/OC`: a code of the tables. */
  type: AdtTypeCode;
  name: string;
}

export async function activateSharedGroup(
  connection: IAbapConnection,
  objects: ISharedGroupMember[],
  logger: ILogger,
): Promise<void> {
  const what = objects.map((o) => `${o.type} ${o.name}`).join(', ');
  const utils = new AdtUtils(connection, logger, {
    ...utilDocuments,
    activation: wireItself,
  });
  const started = await utils.activateObjectsGroup(objects, undefined, {
    analyse: analyseException,
    headers: integrationHeadersOf(utils, 'activateObjectsGroup'),
  });
  if (!started.ok) {
    throw new Error(
      `group activation of ${what}: ${started.getError().message}`,
    );
  }
  const wire = started.getResult().value;
  const runId = /runs\/([^/?]+)/.exec(
    String(wire?.headers?.location ?? wire?.headers?.Location ?? ''),
  )?.[1];
  if (!runId) {
    throw new Error(`group activation of ${what} answered no run id`);
  }
  let finished = false;
  for (let reads = 0; reads < 10 && !finished; reads++) {
    // Every poll is read: a refused one fails with what SAP said, it is not
    // an empty status to retry past.
    const state = expectResult(
      await utils.getActivationRun(runId, {
        analyse: analyseException,
        withLongPolling: true,
      }),
      `poll group activation run ${runId} of ${what}`,
    );
    const status = attributeValues(
      parseXmlDocument(String(state ?? ''), `group activation run ${runId}`),
      'status',
    )[0];
    finished = Boolean(status && status !== 'running' && status !== 'waiting');
  }
  if (!finished) {
    throw new Error(`group activation run ${runId} of ${what} did not finish`);
  }
  // The verdict is the call's strategy: executed, and no message of type E.
  expectResult(
    await utils.getActivationResults(runId, {
      analyse: judged(analyseActivationExecuted),
    }),
    `group activation of ${what} (run ${runId})`,
  );
  logger.info?.(`group activation of ${what} finished`);
}

/**
 * The verdict this suite asks of a group activation's results, as a strategy
 * for the call: the activation was executed (`activationExecuted="true"` on
 * some element) and no `msg` is of type E. Read as a tree, so an error is
 * every `msg` of type E whatever its text — an empty or a namespaced text
 * element included; the text is only the diagnostic.
 *
 * **Stricter than adt-strategies' `analyseActivation`, on purpose.** The
 * library reads `activationExecuted="false"` with no messages as "nothing to
 * activate" and lets it pass — right for a consumer activating objects that
 * may already be active. The objects a test activates in a group were written
 * inactive just before, so an activation that did not execute left them
 * inactive: here that is a refusal. `activationExecuted="true"` beside an
 * error is a refusal too (the errata): the object stays inactive.
 *
 * Pass it composed — `judged(analyseActivationExecuted)` — so an exception
 * document inside a 200 is read first.
 */
export const analyseActivationExecuted: IAnalyse<IAdtError> = (
  verdict,
  answer,
) => {
  if (verdict !== ADT_NO_FAILURE) return verdict;
  const results = String(answer?.data ?? '');
  const tree = parseXmlDocument(results, 'the activation results');
  const errors = elementsNamed(tree, 'msg').filter(
    (msg) => attributeOf(msg, 'type') === 'E',
  );
  const executed = attributeValues(tree, 'activationExecuted').includes('true');
  if (executed && errors.length === 0) return ADT_NO_FAILURE;
  const said = errors
    .map(
      (msg) =>
        elementsNamed(msg, 'txt')
          .map((txt) => textOf(txt))
          .filter(Boolean)
          .join(' ') || '(no text)',
    )
    .join('; ');
  return {
    origin: 'refusal',
    message:
      said || `the activation was not executed: ${results.slice(0, 600)}`,
    response: answer,
  } as IAdtError;
};
