/**
 * Activate shared objects that name each other in one group run, and fail on
 * anything short of an activation that happened.
 *
 * The shared objects marked `skip_activation: true` in `shared_dependencies`
 * are written inactive by `ensureSharedDependency`; this is the step that
 * activates them. An AMDP class and the table function it implements are the
 * case: neither activates alone.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtUtils } from '../../core/shared/AdtUtils';
import { utilDocuments } from '../../core/shared/utilResultSet';
import { wireItself } from '../../utils/resultStrategy';
import { integrationHeadersOf } from './adtHeaders';

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
    const state = await utils.getActivationRun(runId, {
      withLongPolling: true,
    });
    const status = /status="([^"]*)"/.exec(
      String(state.ok ? state.getResult().value : ''),
    )?.[1];
    finished = Boolean(status && status !== 'running' && status !== 'waiting');
  }
  if (!finished) {
    throw new Error(`group activation run ${runId} of ${what} did not finish`);
  }
  const outcome = await utils.getActivationResults(runId);
  const results = String(outcome.ok ? outcome.getResult().value : '');
  // activationExecuted="true" beside an error message is still a failure (the
  // errata): the object stays inactive.
  const errors = [
    ...results.matchAll(
      /<msg\b[^>]*type="E"[^>]*>[\s\S]*?<txt>([^<]*)<\/txt>/g,
    ),
  ].map((m) => m[1]);
  if (!/activationExecuted="true"/.test(results) || errors.length) {
    throw new Error(
      `group activation of ${what}: ${errors.join('; ') || results.slice(0, 600)}`,
    );
  }
  logger.info?.(`group activation of ${what} finished`);
}
