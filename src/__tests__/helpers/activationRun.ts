/**
 * Wait for a group activation, as a consumer writes it.
 *
 * `activateObjectsGroup` started the run, polled `/activation/runs/{runId}`
 * until the status left the running state, and answered the results. Three
 * requests and a wait in one member, so it could not stay one: how long to
 * allow and what a failure means are decisions about the caller's work.
 *
 * The sequence is here rather than repeated at each call site, because several
 * tests need it and a copy per test is a copy per mistake.
 */
import type { ILogger } from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../clients/AdtClient';
import type { IObjectReference } from '../../core/shared/types';

export interface IActivationOutcome {
  readonly runId: string;
  /** The last `/activation/runs/{runId}` document read. */
  readonly status: string;
  /** What `/activation/results/{runId}` answered, once the run was done. */
  readonly results: string;
}

/** `runs:status` out of the run document, whatever prefix the server used. */
export function activationStatusIn(document: string): string {
  return document.match(/[\w:]*status="([^"]+)"/)?.[1] ?? '';
}

/**
 * Start a group activation and wait for it to reach a terminal status.
 *
 * `withLongPolling` is on: the server holds each read open rather than
 * answering at once, so this is a wait rather than a spin. The deadline is the
 * caller's, and a run still going when it passes raises — a test that carried
 * on regardless would be asserting against a system mid-activation.
 */
export async function activateAndWait(
  client: AdtClient,
  objects: IObjectReference[],
  options?: { deadlineMs?: number; logger?: ILogger },
): Promise<IActivationOutcome> {
  const utils = client.getUtils();

  const started = await utils.activateObjectsGroup(objects, false);
  if (!started.ok) {
    throw new Error(`activation was refused: ${started.getError().message}`);
  }
  const runId = started.getResult().value;
  if (!runId) {
    throw new Error('the activation start carried no run id in its Location');
  }

  const deadline = Date.now() + (options?.deadlineMs ?? 120_000);
  let status = '';
  while (Date.now() < deadline) {
    const answer = await utils.getActivationRun(runId, {
      withLongPolling: true,
    });
    if (!answer.ok) {
      throw new Error(`run ${runId}: ${answer.getError().message}`);
    }
    status = activationStatusIn(String(answer.getResult().value));
    options?.logger?.debug?.(`activation run ${runId}: ${status}`);
    if (status !== 'running' && status !== 'scheduled' && status !== '') break;
  }

  if (status === 'running' || status === 'scheduled') {
    throw new Error(`run ${runId} was still ${status} at the deadline`);
  }

  const results = await utils.getActivationResults(runId);
  if (!results.ok) {
    throw new Error(`results for ${runId}: ${results.getError().message}`);
  }

  return { runId, status, results: String(results.getResult().value) };
}
