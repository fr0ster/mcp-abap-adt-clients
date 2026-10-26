/**
 * ProgramTestRunnerLegacy — a report's ABAP Unit tests on a legacy system
 * (BASIS < 7.50), which has no `/sap/bc/adt/abapunit/runs`.
 *
 * `runSync` is the inherited one: `/sap/bc/adt/abapunit/testruns` given the
 * report's URI, with `<options>`, answered the finished result on 7.40 SP04.
 * `run` sends the same request, read by the `run` strategy — on 7.40 that POST
 * is the run. There is no run id, so `getStatus` and `getResult` are refused.
 */

import {
  type IProgramTestRunnerResults,
  PROGRAM,
  ProgramTestRunner,
  type programTestRunnerDocuments,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IClassUnitTestRunOptions,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import {
  noResultToFetch,
  noRunToPoll,
  runSyncLegacy,
} from '../abapUnitRunLegacy';

export class ProgramTestRunnerLegacy<
  R extends IProgramTestRunnerResults = typeof programTestRunnerDocuments,
> extends ProgramTestRunner<R> {
  /** Run every test class of the report: the `runSync` request, read by `run`. */
  override async run<E extends IAdtError = IAdtError>(
    programName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return runSyncLegacy(
      this.connection,
      [PROGRAM.uri(programName)],
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      options,
    );
  }

  override async getStatus<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['status']>, E>
  > {
    return noRunToPoll<ReturnType<R['status']>, E>();
  }

  override async getResult<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['result']>, E>
  > {
    return noResultToFetch<ReturnType<R['result']>, E>();
  }
}
