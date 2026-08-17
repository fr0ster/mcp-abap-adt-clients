/**
 * ATC check runs: start one, ask whether it is done, read what it found.
 *
 * Three capabilities and no more. A check run is not created, updated, locked,
 * activated or versioned — it is run, and then read — so this declares
 * `IAdtRunnable` plus two readers rather than `IAdtObject`.
 *
 * **Nothing here defaults a missing value.** Each response this depends on
 * carries one thing the next step cannot work without, and where that thing is
 * absent the call fails naming it. A missing `Location` never becomes the
 * worklist id and a missing `FINDING_STATS` never becomes `"0,0,0"`: the
 * dangerous outcome on an unfamiliar system is not an exception, it is a
 * confident zero that reads exactly like a clean check.
 */

import {
  AdtObjectErrorCodes,
  AdtOperationError,
  type IAbapConnection,
  type IAdtResponse,
  type IAdtRunnable,
  type IAtcFindings,
  type IAtcRunOptions,
  type IAtcRunResult,
  type IAtcRunStatus,
  type IAtcRunStatusReadable,
  type IAtcRunTarget,
  type ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  buildAtcObjectUri,
  createAtcWorklist,
  getAtcCustomizing,
  getAtcRunStatus,
  getAtcWorklist,
  parseSystemCheckVariant,
  startAtcRun,
} from './run';

/** The default cap on results, and the only value anyone has run with. */
const DEFAULT_MAXIMUM_VERDICTS = 100;

function asText(data: unknown): string {
  return typeof data === 'string' ? data : String(data ?? '');
}

/** Header lookup that does not assume the server's capitalisation. */
function header(
  headers: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  const value = key ? headers[key] : undefined;
  return typeof value === 'string' ? value : undefined;
}

export class AdtAtc
  implements
    IAdtRunnable<IAtcRunTarget, IAtcRunResult, IAtcRunOptions>,
    IAtcRunStatusReadable,
    IAtcFindings
{
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async run(
    target: IAtcRunTarget,
    options?: IAtcRunOptions,
  ): Promise<IAtcRunResult> {
    // `options` is optional in the contract, so every read of it is guarded.
    // A caller writing `run(target)` is doing what the interface allows.
    const wait = options?.wait ?? false;
    const maximumVerdicts =
      options?.maximumVerdicts ?? DEFAULT_MAXIMUM_VERDICTS;

    this.assertTarget(target);
    this.assertMaximumVerdicts(maximumVerdicts);

    const checkVariant =
      options?.checkVariant ?? (await this.resolveCheckVariant());

    const worklistId = await this.createWorklist(checkVariant);
    const uris = target.objects.map((o) =>
      buildAtcObjectUri(o.objectType, o.objectName),
    );

    const response = await startAtcRun(
      this.connection,
      worklistId,
      uris,
      maximumVerdicts,
      wait,
    );

    return wait
      ? this.readWaitingRun(response, worklistId)
      : this.readStartedRun(response, worklistId);
  }

  async getRunStatus(runId: string): Promise<IAtcRunStatus> {
    const response = await getAtcRunStatus(this.connection, runId);
    const body = asText(response.data);

    const status = body.match(/runs:status="([^"]+)"/)?.[1];
    if (!status) {
      const error = new AdtOperationError(
        `ATC run ${runId}: the run resource carried no runs:status. IAtcRunStatus.status is not optional, and resolving with undefined through it would be a lie the type cannot catch.`,
      );
      error.code = 'ATC_RUN_STATUS_MISSING';
      throw error;
    }

    return {
      status,
      // Exact and case-normalised. A substring test would accept `unfinished`
      // and `not_finished`, opening the worklist on a run that had not run.
      isFinished: status.trim().toLowerCase() === 'finished',
      worklistId: this.linkId(body, 'worklistid'),
      resultId: this.linkId(body, 'displayid'),
    };
  }

  async getFindings(worklistId: string): Promise<IAdtResponse> {
    return getAtcWorklist(this.connection, worklistId);
  }

  // ---------------------------------------------------------------- private

  private assertTarget(target: IAtcRunTarget): void {
    // The tuple type stops a TypeScript caller; a JavaScript one arrives here
    // anyway, and an empty object set would start a run over nothing.
    if (!target?.objects?.length) {
      const error = new AdtOperationError(
        'ATC run needs at least one object to check.',
      );
      error.code = AdtObjectErrorCodes.VALIDATION_FAILED;
      throw error;
    }
  }

  private assertMaximumVerdicts(value: number): void {
    if (!Number.isInteger(value) || value < 1) {
      const error = new AdtOperationError(
        `maximumVerdicts must be a positive integer, got ${value}. The server answers 0 with a 400, and a client that can name the problem should not spend a round trip being told.`,
      );
      error.code = AdtObjectErrorCodes.VALIDATION_FAILED;
      throw error;
    }
  }

  private async resolveCheckVariant(): Promise<string> {
    const response = await getAtcCustomizing(this.connection);
    const variant = parseSystemCheckVariant(response.data);
    if (!variant) {
      const error = new AdtOperationError(
        'ATC customizing carried no systemCheckVariant, and no checkVariant was given. Creating a worklist with an undefined variant would leave the server to decide what that means.',
      );
      error.code = 'ATC_NO_CHECK_VARIANT';
      throw error;
    }
    this.logger?.debug?.(`ATC check variant from customizing: ${variant}`);
    return variant;
  }

  private async createWorklist(checkVariant: string): Promise<string> {
    const response = await createAtcWorklist(this.connection, checkVariant);
    const worklistId = asText(response.data).trim();
    // Non-empty, and nothing more specific: the observed ids are 32-character
    // hex on one system, but no contract states a format, and a stricter test
    // would risk refusing a valid id from a system nobody has probed.
    if (!worklistId) {
      const error = new AdtOperationError(
        'ATC worklist creation answered with no id. A run against an empty worklist id is a request nobody can interpret.',
      );
      error.code = 'ATC_NO_WORKLIST_ID';
      throw error;
    }
    return worklistId;
  }

  /** `clientWait=false`: 201, empty body, the run id in `Location`. */
  private readStartedRun(
    response: IAdtResponse,
    worklistId: string,
  ): IAtcRunResult {
    const location =
      header(response.headers as Record<string, unknown>, 'location') ??
      header(response.headers as Record<string, unknown>, 'content-location');
    if (!location) {
      const error = new AdtOperationError(
        'ATC run was accepted without a Location header, so it has no run id to poll. Falling back to the worklist id would look like success and fetch a run that does not exist.',
      );
      error.code = 'ATC_NO_RUN_LOCATION';
      throw error;
    }
    const runId = location.replace(/\/+$/, '').split('/').pop();
    if (!runId) {
      const error = new AdtOperationError(
        `ATC run Location carried no id: ${location}`,
      );
      error.code = 'ATC_NO_RUN_LOCATION';
      throw error;
    }
    return { waited: false, worklistId, runId };
  }

  /** `clientWait=true`: 200, `<atcworklist:worklistRun>` with FINDING_STATS. */
  private readWaitingRun(
    response: IAdtResponse,
    worklistId: string,
  ): IAtcRunResult {
    const body = asText(response.data);
    const findingStats = this.findingStats(body);
    if (!findingStats) {
      const error = new AdtOperationError(
        'ATC waiting run answered without FINDING_STATS. Defaulting it to "0,0,0" would report a confident zero, which is indistinguishable from a clean check.',
      );
      error.code = 'ATC_NO_FINDING_STATS';
      throw error;
    }

    // The response echoes a worklist id. The one returned is the one this
    // handler created — that is the id it controls and the id getFindings
    // takes — so a differing echo is worth a warning and nothing more. It is
    // not an error: the contract does not make it one, and turning a usable
    // answer into a failure is not a decision an implementation gets to make.
    const echoed = body.match(
      /<atcworklist:worklistId>([^<]+)<\/atcworklist:worklistId>/,
    )?.[1];
    if (echoed && echoed !== worklistId) {
      this.logger?.warn?.(
        `ATC run echoed worklist ${echoed} but was started against ${worklistId}; returning the one this client created.`,
      );
    }

    return { waited: true, worklistId, findingStats };
  }

  private findingStats(body: string): string | undefined {
    // FINDING_STATS is an <atcinfo:info> whose type says so; the triple is in
    // the description beside it. Matched as a pair rather than by reaching for
    // the first description in the document.
    const info = body.match(
      /<atcinfo:type>FINDING_STATS<\/atcinfo:type>\s*<atcinfo:description>([^<]*)<\/atcinfo:description>/,
    );
    return info?.[1];
  }

  private linkId(body: string, rel: string): string | undefined {
    const link = body.match(
      new RegExp(`href="([^"]+)"[^>]*rel="[^"]*${rel}"`, 'i'),
    );
    return link?.[1].replace(/\/+$/, '').split('/').pop();
  }
}
