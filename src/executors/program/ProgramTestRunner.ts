/**
 * ProgramTestRunner — running the ABAP Unit tests of a report, and asking about
 * the run.
 *
 * A report's test classes are local classes in the report's own source or in
 * an include it pulls in; writing them is `getProgram().update()` or
 * `getInclude().update()`. What is left is executing them, and executing is an
 * executor's, beside the report's other executor (`ProgramExecutor`, which
 * runs the report itself through `programrun`).
 *
 * Measured on premise (2026-09-30): one `POST /abapunit/runs` naming the report
 * as `osl:object type="PROG"` runs its test classes wherever they sit — own
 * source or include.
 *
 * Measured on premise again (SAP_BASIS 816, 2026-10-23): `/abapunit/testruns`
 * given the report's URI runs the same tests with the same alerts — but only
 * with the Eclipse-style `<options>` in the run configuration. Without it, the
 * body sent on 2026-09-30, it answers `200` with an empty result: that, not the
 * endpoint, was why that run found nothing. `runSync` therefore always sends
 * `<options>`. An include's own URI answers empty even with `<options>`; its
 * tests run through the report.
 *
 * On a legacy system (7.40 SP04, no `/abapunit/runs`),
 * `ProgramTestRunnerLegacy` sends this `/testruns` request
 * with `<options>` from `runSync` as it is here and from `run`. Its `getStatus`
 * and `getResult` are refused (there is no run id).
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAdtRunnable,
  IClassUnitTestRunOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { PROGRAM } from '../../endpoints/objects';
import {
  AbapUnitRunner,
  abapUnitRunnerDocuments,
  type IAbapUnitRunnerResults,
} from '../abapUnitRunner';

export type IProgramTestRunnerResults = IAbapUnitRunnerResults;
export const programTestRunnerDocuments = abapUnitRunnerDocuments;

export class ProgramTestRunner<
    R extends IProgramTestRunnerResults = typeof programTestRunnerDocuments,
  >
  extends AbapUnitRunner<R>
  implements
    IAdtRunnable<string, ReturnType<R['run']>, IClassUnitTestRunOptions>
{
  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    results: R = programTestRunnerDocuments as unknown as R,
  ) {
    super(connection, logger, results);
  }

  /** Run every test class of the report. One POST. */
  async run<E extends IAdtError = IAdtError>(
    programName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return this.startByObject(programName, 'PROG', options);
  }

  /**
   * Run every test class of the report and answer the finished result. One
   * POST, to `/sap/bc/adt/abapunit/testruns` — the synchronous runner, beside
   * the asynchronous `run` + `getStatus` + `getResult`, which stays the
   * default.
   *
   * An explicit choice of the caller's: nothing here asks the system which
   * runner it has. The report is named by its URI and the run configuration
   * always carries `<options>` (scope, risk levels and durations, with `run`'s
   * defaults) — without it the endpoint answered an empty result for a report
   * with tests. `title` and `context` have no place in this format and are not
   * sent. Name the report, not an include: an include's tests run through the
   * report that pulls it in.
   *
   * The answer is the `aunit:runResult` document, read by this runner's
   * `result` strategy — the one `getResult` uses; whether a failing test is a
   * failure is `options.analyse`'s (`analyseUnitTest` from
   * @mcp-abap-adt/adt-strategies reads it so).
   */
  async runSync<E extends IAdtError = IAdtError>(
    programName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['result']>, E>> {
    return this.startSync([PROGRAM.uri(programName)], options);
  }
}
