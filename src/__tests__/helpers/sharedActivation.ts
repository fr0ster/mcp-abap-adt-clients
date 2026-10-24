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
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtUtils } from '../../core/shared/AdtUtils';
import { utilDocuments } from '../../core/shared/utilResultSet';
import { wireItself } from '../../utils/resultStrategy';
import { integrationHeadersOf } from './adtHeaders';
import { expectResult } from './contract';
import {
  attributeOf,
  attributeValues,
  elementsNamed,
  parseXmlDocument,
  textOf,
} from './xmlTree';

export interface ISharedGroupMember {
  /** The ADT type, e.g. `DDLS/DF`, `CLAS/OC`. */
  type: string;
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
  const results = String(
    expectResult(
      await utils.getActivationResults(runId, { analyse: analyseException }),
      `read the results of group activation run ${runId} of ${what}`,
    ) ?? '',
  );
  expectActivationExecuted(results, `group activation of ${what}`);
  logger.info?.(`group activation of ${what} finished`);
}

/**
 * An activation results document that says the activation happened: some
 * element carries `activationExecuted="true"` and no `msg` is of type E.
 *
 * Read as a tree: an error is every `msg` of type E, whatever its text — an
 * empty or a namespaced text element included; the text is only the
 * diagnostic. `activationExecuted="true"` beside an error is still a failure
 * (the errata): the object stays inactive. Throws naming `what`.
 */
export function expectActivationExecuted(results: string, what: string): void {
  const tree = parseXmlDocument(results, `the results of ${what}`);
  const errors = elementsNamed(tree, 'msg').filter(
    (msg) => attributeOf(msg, 'type') === 'E',
  );
  const executed = attributeValues(tree, 'activationExecuted').includes('true');
  if (!executed || errors.length) {
    const said = errors
      .map(
        (msg) =>
          elementsNamed(msg, 'txt')
            .map((txt) => textOf(txt))
            .filter(Boolean)
            .join(' ') || '(no text)',
      )
      .join('; ');
    throw new Error(`${what}: ${said || results.slice(0, 600)}`);
  }
}
