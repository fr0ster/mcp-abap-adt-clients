/**
 * AbapUnitTestRunner — the generic ABAP Unit runner: a run of anything ABAP
 * Unit runs, named by the registry (`ABAP_UNIT_RUN_TYPES` of
 * `@mcp-abap-adt/interfaces-adt`) rather than fixed by the runner.
 *
 * The four per-object runners (class, report, function group, function
 * module) each fix the `osl:object type` they send. This one takes it from
 * the caller, typed `AbapUnitRunObjectType` — every key of the registry and
 * nothing else — so it runs what those four cannot: a CDS view's assigned
 * tests (`DDLS/DF`), a class include (`CLAS/OCL`), a package.
 *
 * - `run(target)` starts one `AbapUnitRunTarget` on `POST /abapunit/runs`:
 *   an object as an `osl:flatObjectSet` with one `osl:object`, a package as an
 *   `osl:packageSet` with one `osl:package` (`startUnitTestRunByTarget`).
 * - `runSync(uris, { headers })` runs objects named by ADT URIs on
 *   `POST /abapunit/testruns` and answers the finished result — the request a
 *   per-object runner's `runSync` sends, with the caller's `Accept` and
 *   `Content-Type`.
 * - `getStatus` and `getResult` ask about a run by its id.
 *
 * **A wrong type is no error.** The endpoint does not refuse a type it does
 * not run: the start answers `201`, and the result is an empty
 * `<aunit:runResult/>` (measured 2026-10-29). The compiler holds `type` to
 * the registry.
 *
 * **Assigned tests execute only with `foreignTests: true`.** A CDS view's
 * tests (an object whose registry entry runs `'assignedTests'`) are local
 * test classes elsewhere marked `"! @testing <view>`. With `foreignTests:
 * false` and the default `addForeignTestsAsPreview: true` they are listed in
 * the result without being executed — no alerts, so a failing test looks
 * like a pass; with the preview off as well, the result is empty (measured 2026-10-29 on S/4HANA 2025 and ABAP cloud).
 * A consumer reading a CDS run sets `scope: { foreignTests: true }`. The
 * scope is the caller's.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */

import type {
  AbapUnitRunTarget,
  AdtVariant,
  IAbapUnitRunner,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
  IClassUnitTestRunOptions,
  IResultStrategy,
  IUnitTestResultOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, IAdtServedOn } from '../clients/variant';
import {
  getUnitTestRunResult,
  getUnitTestRunStatus,
  startUnitTestRunByTarget,
  startUnitTestRunSyncWith,
} from '../core/shared/abapUnit';
import { answering } from '../utils/adtResponse';
import {
  abapUnitRunnerDocuments,
  type IAbapUnitRunnerResults,
} from './abapUnitRunner';

/**
 * One strategy per distinct answer: starting a run, polling it, its result.
 * `runSync` answers the result document itself, so it is read by `result`.
 */
export type IAbapUnitTestRunnerResults = IAbapUnitRunnerResults;

/**
 * The shipped default: documents as they arrived. A run's id is in a header
 * of the start's answer, so a caller who wants it passes `unitTestRunId` from
 * @mcp-abap-adt/adt-strategies for `run`.
 */
export const abapUnitTestRunnerDocuments = abapUnitRunnerDocuments;

/**
 * The gate of the members on `/abapunit/runs` — `run`, `getStatus`,
 * `getResult`: a modern system, on premise or cloud. SAP_BASIS 7.40 has no
 * `/runs`; its runner is the legacy package's, whose refusals stay for
 * callers outside the type system.
 */
type OnRunsEndpoint = IAdtServedOn<AdtModernVariant>;

export class AbapUnitTestRunner<
  R extends IAbapUnitTestRunnerResults = typeof abapUnitTestRunnerDocuments,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAbapUnitRunner<
      ReturnType<R['run']>,
      ReturnType<R['status']>,
      ReturnType<R['result']>
    >
{
  /**
   * The release variant this serves, as a type only — never set. The
   * members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly results: R;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    results: R = abapUnitTestRunnerDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.results = results;
  }

  /**
   * Start a run of one target. One POST, to `/sap/bc/adt/abapunit/runs`.
   *
   * An object target names one object by `name` and `type`; a package target
   * names a package, with or without its subpackages. The run's id is in a
   * header of the answer — construct this with `unitTestRunId` from
   * @mcp-abap-adt/adt-strategies for `run` to be answered the id, and pass
   * `analyseUnitTestStart` to have an id-less answer read as a failure.
   */
  async run<E extends IAdtError = IAdtError>(
    this: this & OnRunsEndpoint,
    target: AbapUnitRunTarget,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return answering(
      () => startUnitTestRunByTarget(this.connection, target, options),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      options?.analyse,
    );
  }

  /**
   * Run the objects the ADT URIs name and answer the finished result. One
   * POST, to `/sap/bc/adt/abapunit/testruns`, with the caller's `Accept` and
   * `Content-Type` and always with `<options>` — without it a report's, a
   * function group's and a function module's run answered an empty result
   * (see `core/shared/abapUnit`). The answer is the result document, read by
   * `result`, the strategy `getResult` uses; `options.analyse` judges it.
   * `title` and `context` have no place in this format and are not sent.
   */
  async runSync<E extends IAdtError = IAdtError>(
    uris: readonly [string, ...string[]],
    options: { headers: IAdtHeaders } & IClassUnitTestRunOptions &
      IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['result']>, E>> {
    // `runOptions` is an object even when the caller gave only the headers,
    // so the `<options>` element is always sent.
    const { analyse, headers, ...runOptions } = options;
    return answering(
      () =>
        startUnitTestRunSyncWith(this.connection, headers, uris, runOptions),
      this.results.result as IResultStrategy<ReturnType<R['result']>>,
      analyse,
    );
  }

  /**
   * Poll a run. Takes the run it is about: nothing here remembers the last one
   * started, because ADT does not either — any holder of the id may ask.
   */
  async getStatus<E extends IAdtError = IAdtError>(
    this: this & OnRunsEndpoint,
    runId: string,
    withLongPolling: boolean | undefined = true,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['status']>, E>> {
    return answering(
      () =>
        getUnitTestRunStatus(this.connection, runId, withLongPolling ?? true),
      this.results.status as IResultStrategy<ReturnType<R['status']>>,
      options?.analyse,
    );
  }

  /** The result document of a finished run. */
  async getResult<E extends IAdtError = IAdtError>(
    this: this & OnRunsEndpoint,
    runId: string,
    options?: IUnitTestResultOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['result']>, E>> {
    return answering(
      () => getUnitTestRunResult(this.connection, runId, options),
      this.results.result as IResultStrategy<ReturnType<R['result']>>,
      options?.analyse,
    );
  }
}
