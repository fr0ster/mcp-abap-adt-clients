/**
 * ProgramTestRunnerLegacy — a report's ABAP Unit tests on a legacy system
 * (SAP_BASIS 7.40, measured on 7.40 SP04), which has no `/sap/bc/adt/abapunit/runs`.
 *
 * `runSync` is the inherited one: `/sap/bc/adt/abapunit/testruns` given the
 * report's URI, with `<options>`, answered the finished result on 7.40 SP04.
 * `run` sends the same request, read by the `run` strategy — on 7.40 that POST
 * is the run. There is no run id, so `getStatus` and `getResult` are refused.
 */

import {
  type AbapUnitRunnerValues,
  type AdtPerformedBy,
  PROGRAM,
  ProgramTestRunner,
  type programTestRunnerDocuments,
  type ResultValuesOf,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
  IClassUnitTestRunOptions,
  IUnitTestResultOptions,
} from '@mcp-abap-adt/interfaces-adt';
import {
  noResultToFetch,
  noRunToPoll,
  runSyncLegacy,
} from '../abapUnitRunLegacy';

export class ProgramTestRunnerLegacy<
  T extends AbapUnitRunnerValues = ResultValuesOf<
    typeof programTestRunnerDocuments
  >,
> extends ProgramTestRunner<T, 'basis740'> {
  /** Run every test class of the report: the `runSync` request, read by `run`. */
  override run<E extends IAdtError>(
    this: this & AdtPerformedBy<'program', 'unitTestRun'>,
    programName: string,
    options: IClassUnitTestRunOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['run'], E | IAdtError>>;
  override run(
    this: this & AdtPerformedBy<'program', 'unitTestRun'>,
    programName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['run'], IAdtError>>;
  override async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'unitTestRun'>,
    programName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E | IAdtError>> {
    return runSyncLegacy(
      this.connection,
      [PROGRAM.uri(programName)],
      this.results.run,
      options,
    );
  }

  override getStatus<E extends IAdtError>(
    this: this & AdtPerformedBy<'program', 'unitTestStatus'>,
    runId: string,
    withLongPolling: boolean | undefined,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['status'], E | IAdtError>>;
  override getStatus(
    this: this & AdtPerformedBy<'program', 'unitTestStatus'>,
    runId: string,
    withLongPolling?: boolean | undefined,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['status'], IAdtError>>;
  override async getStatus<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'unitTestStatus'>,
    _runId: string,
    _withLongPolling?: boolean | undefined,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['status'], E | IAdtError>> {
    return noRunToPoll<T['status']>();
  }

  override getResult<E extends IAdtError>(
    this: this & AdtPerformedBy<'program', 'unitTestResult'>,
    runId: string,
    options: IUnitTestResultOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['result'], E | IAdtError>>;
  override getResult(
    this: this & AdtPerformedBy<'program', 'unitTestResult'>,
    runId: string,
    options?: IUnitTestResultOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['result'], IAdtError>>;
  override async getResult<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'unitTestResult'>,
    _runId: string,
    _options?: IUnitTestResultOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['result'], E | IAdtError>> {
    return noResultToFetch<T['result']>();
  }
}
