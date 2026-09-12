/**
 * Activate several objects — **this is what `activateAndWait` used to do.**
 *
 * Three members over three endpoints, and the waiting is yours. The removed
 * member chose a deadline, a poll interval and what counts as finished, for
 * every caller.
 *
 * `activateObjectsGroup` answers the run id — the server puts it in `Location`
 * and the body carries nothing. Which status ends your wait is a question about
 * your system's answers, so it is read here rather than decided for you.
 */

import type { IObjectReference } from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../src/clients/AdtClient';

const statusIn = (document: string): string =>
  /runs:status="([^"]*)"/.exec(document)?.[1] ?? '';

export async function activateAGroup(
  client: AdtClient,
  objects: IObjectReference[],
  deadlineMs = 60_000,
): Promise<string> {
  const utils = client.getUtils();

  const started = await utils.activateObjectsGroup(objects);
  if (!started.ok) throw new Error(started.getError().message);
  const runId = started.getResult().value;
  if (!runId) throw new Error('the start carried no run id');

  // The wait, four lines, written by whoever wants it. `withLongPolling` asks
  // the server to hold the request open rather than answering at once, so this
  // is not a tight loop even without a delay.
  const until = Date.now() + deadlineMs;
  let status = '';
  while (Date.now() < until) {
    const run = await utils.getActivationRun(runId, { withLongPolling: true });
    if (!run.ok) throw new Error(run.getError().message);
    status = statusIn(String(run.getResult().value ?? ''));
    if (status === 'finished') break;
  }
  if (status !== 'finished') {
    throw new Error(
      `activation run ${runId} was ${status || 'silent'} at the deadline`,
    );
  }

  const results = await utils.getActivationResults(runId);
  if (!results.ok) throw new Error(results.getError().message);
  return String(results.getResult().value ?? '');
}
