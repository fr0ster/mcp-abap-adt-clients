/**
 * ATC check runs: the check variant, a worklist, the run, its status, its
 * findings — one request each.
 *
 * Three contract capabilities and two members of its own. A check run is not
 * created, updated, locked, activated or versioned — it is run, and then read.
 *
 * **Nothing here reads a verdict into an answer.** Each answer a run depends on
 * carries one thing the next step cannot work without — a check variant, a
 * worklist id, a run id in `Location`, `FINDING_STATS`, `runs:status`. Whether
 * its absence is a failure is the caller's `analyse` to say, and what the
 * answer becomes is the result strategy this was constructed with. The
 * readings that pull those values out are `atcSystemCheckVariant`,
 * `atcWorklistId`, `atcStartedRun`, `atcWaitingRun` and `atcRunStatus` in
 * `@mcp-abap-adt/adt-strategies`; none of them defaults a missing value, so a
 * missing `FINDING_STATS` never becomes a confident `"0,0,0"`.
 */

import {
  AdtObjectErrorCodes,
  type IAdtAnalyseOptions,
  type IAdtError,
  type IAdtResponse,
  type IAtcFindings,
  type IAtcRunOptions,
  type IAtcRunStatusReadable,
  type IAtcRunTarget,
  type IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtOperationError } from '../../utils/adtErrors';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import {
  buildAtcObjectUri,
  createAtcWorklist,
  getAtcCustomizing,
  getAtcRunStatus,
  getAtcWorklist,
  startAtcRun,
} from './run';

/** The default cap on results, and the only value anyone has run with. */
const DEFAULT_MAXIMUM_VERDICTS = 100;

/** One strategy per distinct answer of an ATC run. */
export interface IAtcResults {
  /** `/atc/customizing` — `resolveCheckVariant`. */
  readonly checkVariant: IResultStrategy<unknown>;
  /** `/atc/worklists` POST, a bare id in `text/plain` — `createWorklist`. */
  readonly worklist: IResultStrategy<unknown>;
  /**
   * A run started with `wait: false`: 201, an empty body, the run id in
   * `Location`. `rawDocument` reads the body, so it answers `''` — a caller who
   * wants the run id passes `atcStartedRun`.
   */
  readonly startedRun: IResultStrategy<unknown>;
  /** A run started with `wait: true`: 200, `<atcworklist:worklistRun>`. */
  readonly waitingRun: IResultStrategy<unknown>;
  /** The run resource — `getRunStatus`. */
  readonly runStatus: IResultStrategy<unknown>;
  /** The worklist — `getFindings`. */
  readonly findings: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const atcDocuments = {
  checkVariant: rawDocument,
  worklist: rawDocument,
  startedRun: rawDocument,
  waitingRun: rawDocument,
  runStatus: rawDocument,
  findings: rawDocument,
} satisfies IAtcResults;

/**
 * **Not `IAdtRunnable` since 19.0.0.** That atom's `run` is one call, and an
 * ATC run is three: the check variant, a worklist for it, then the run itself.
 * A member that made all three chose the order and denied the caller a worklist
 * they could reuse. The atom stays in the contract for whoever composes them.
 */
export class AdtAtc<R extends IAtcResults = typeof atcDocuments>
  implements
    IAtcRunStatusReadable<ReturnType<R['runStatus']>>,
    IAtcFindings<ReturnType<R['findings']>>
{
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = atcDocuments as unknown as R,
  ) {}

  /**
   * Start a run against a worklist — `/atc/runs`.
   *
   * **One request.** This was `run(target, options)` until 19.0.0, and it made
   * three: the check variant out of customizing, a worklist for it, then the
   * run. The first two are members of their own now
   * ({@link resolveCheckVariant}, {@link createWorklist}) and the caller calls
   * them in the order they want — reusing a worklist across runs, or naming a
   * variant without asking the system for one.
   *
   * `wait` decides the shape of the answer, not just its timing, so it decides
   * which strategy reads it: `waitingRun` when the server held the request,
   * `startedRun` when it did not.
   */
  async startRun<E extends IAdtError = IAdtError>(
    worklistId: string,
    target: IAtcRunTarget,
    options: IAtcRunOptions & { wait: true } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['waitingRun']>, E>>;
  async startRun<E extends IAdtError = IAdtError>(
    worklistId: string,
    target: IAtcRunTarget,
    options?: IAtcRunOptions & { wait?: false } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['startedRun']>, E>>;
  async startRun<E extends IAdtError = IAdtError>(
    worklistId: string,
    target: IAtcRunTarget,
    options?: IAtcRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<
    IAdtResponse<ReturnType<R['waitingRun']> | ReturnType<R['startedRun']>, E>
  >;
  async startRun<E extends IAdtError = IAdtError>(
    worklistId: string,
    target: IAtcRunTarget,
    options?: IAtcRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<
    IAdtResponse<ReturnType<R['waitingRun']> | ReturnType<R['startedRun']>, E>
  > {
    const wait = options?.wait ?? false;
    const maximumVerdicts =
      options?.maximumVerdicts ?? DEFAULT_MAXIMUM_VERDICTS;

    this.assertTarget(target);
    this.assertMaximumVerdicts(maximumVerdicts);

    const uris = target.objects.map((o) =>
      buildAtcObjectUri(o.objectType, o.objectName),
    );

    return answering(
      () =>
        startAtcRun(this.connection, worklistId, uris, maximumVerdicts, wait),
      (wait
        ? this.results.waitingRun
        : this.results.startedRun) as IResultStrategy<
        ReturnType<R['waitingRun']> | ReturnType<R['startedRun']>
      >,
      options?.analyse,
    );
  }

  async getRunStatus<E extends IAdtError = IAdtError>(
    runId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['runStatus']>, E>> {
    return answering(
      () => getAtcRunStatus(this.connection, runId),
      this.results.runStatus as IResultStrategy<ReturnType<R['runStatus']>>,
      options?.analyse,
    );
  }

  async getFindings<E extends IAdtError = IAdtError>(
    worklistId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['findings']>, E>> {
    return answering(
      () => getAtcWorklist(this.connection, worklistId),
      this.results.findings as IResultStrategy<ReturnType<R['findings']>>,
      options?.analyse,
    );
  }

  /**
   * ATC customizing, which carries the system's check variant —
   * `/atc/customizing`.
   *
   * One request. Public since 19.0.0 because {@link startRun} no longer fetches
   * it: which variant a run uses is the caller's choice, and asking for the
   * system default is one of the things they may choose. `atcSystemCheckVariant`
   * reads the variant out of it; a customizing without one reads as `''`.
   */
  async resolveCheckVariant<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['checkVariant']>, E>> {
    return answering(
      () => getAtcCustomizing(this.connection),
      this.results.checkVariant as IResultStrategy<
        ReturnType<R['checkVariant']>
      >,
      options?.analyse,
    );
  }

  /**
   * A worklist for a variant — `/atc/worklists`.
   *
   * One request, answering a bare id in its body (`atcWorklistId` trims it).
   * Public for the same reason as {@link resolveCheckVariant}: the run is a
   * sequence now, and this is one of its steps.
   */
  async createWorklist<E extends IAdtError = IAdtError>(
    checkVariant: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['worklist']>, E>> {
    return answering(
      () => createAtcWorklist(this.connection, checkVariant),
      this.results.worklist as IResultStrategy<ReturnType<R['worklist']>>,
      options?.analyse,
    );
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
}
