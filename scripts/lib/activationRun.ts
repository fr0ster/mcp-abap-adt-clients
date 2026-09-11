/**
 * Wait for a group activation, as a consumer writes it.
 *
 * `activateObjectsGroup` started the run, polled `/activation/runs/{runId}`
 * until the status left the running state, and answered the results. Three
 * requests and a wait in one member, so it could not stay one: how long to
 * allow and what a failure means are decisions about the caller's work.
 *
 * It lives under `scripts/`, beside the package and function-group walks and
 * the table statement — outside the published package, which ships only `dist`,
 * `docs/usage`, the README and the licences. That is deliberate and load-
 * bearing: this file is a **consumer's** sequence, and a consumer's sequence
 * inside `src/` would be the join this release removed, one directory over and
 * one pull request away from being exported again.
 *
 * The sequence is written once rather than repeated at each call site, because
 * several callers need it and a copy per caller is a copy per mistake.
 */
import type { ILogger } from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../src/clients/AdtClient';
import type { IObjectReference } from '../../src/core/shared/types';

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
 * Start a group activation and wait for it to **finish**.
 *
 * `withLongPolling` is on: the server holds each read open rather than
 * answering at once, so this is a wait rather than a spin.
 *
 * **It raises on anything but `finished`**, and that is this helper being a
 * caller rather than the package being one. Reading `runs:status` is a
 * judgement, and 19.0.0 moved judgements to whoever is asking — here the asker
 * is a test or a setup script that needs the objects actually active before it
 * looks at them. `error` and `failed` are failures; a status that never
 * arrived by the deadline is a failure too, because carrying on would assert
 * against a system still activating.
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
  let finished = false;

  while (Date.now() < deadline) {
    const answer = await utils.getActivationRun(runId, {
      withLongPolling: true,
    });
    if (!answer.ok) {
      throw new Error(`run ${runId}: ${answer.getError().message}`);
    }
    status = activationStatusIn(String(answer.getResult().value));
    options?.logger?.debug?.(`activation run ${runId}: ${status || '(none)'}`);

    if (status === 'finished') {
      finished = true;
      break;
    }
    if (status === 'error' || status === 'failed') {
      throw new Error(`activation run ${runId} ended as ${status}`);
    }
    // Anything else — `running`, `scheduled`, or a status this reading did not
    // find — is not an ending, so the wait continues until the deadline says
    // otherwise. An unrecognised status is not treated as success: a document
    // nobody here can read is a reason to keep asking, not to move on.
  }

  if (!finished) {
    throw new Error(
      `activation run ${runId} had not finished at the deadline; last status was ${status || 'not found in the document'}`,
    );
  }

  const results = await utils.getActivationResults(runId);
  if (!results.ok) {
    throw new Error(`results for ${runId}: ${results.getError().message}`);
  }

  return { runId, status, results: String(results.getResult().value) };
}
