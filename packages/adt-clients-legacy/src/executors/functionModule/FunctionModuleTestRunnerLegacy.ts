/**
 * FunctionModuleTestRunnerLegacy — a function module's ABAP Unit tests on a
 * legacy system (SAP_BASIS 7.40, measured on 7.40 SP04), which has no `/sap/bc/adt/abapunit/runs`.
 *
 * `runSync` is the inherited one: `/sap/bc/adt/abapunit/testruns` given the
 * module's URI, with `<options>`, answered the finished result on 7.40 SP04 —
 * covering the tests of the module's whole group. `run` is refused: it is
 * given the module alone, and the module's URI lies under its group. There is
 * no run id, so `getStatus` and `getResult` are refused.
 */

import {
  type AbapUnitRunnerValues,
  type AdtPerformedBy,
  FunctionModuleTestRunner,
  failed,
  type functionModuleTestRunnerDocuments,
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
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { noResultToFetch, noRunToPoll } from '../abapUnitRunLegacy';

export class FunctionModuleTestRunnerLegacy<
  T extends AbapUnitRunnerValues = ResultValuesOf<
    typeof functionModuleTestRunnerDocuments
  >,
> extends FunctionModuleTestRunner<T, 'basis740'> {
  /** Refused without a request: see the class's comment. */
  override run<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'unitTestRun'>,
    functionModuleName: string,
    options: IClassUnitTestRunOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['run'], E | IAdtError>>;
  override run(
    this: this & AdtPerformedBy<'functionModule', 'unitTestRun'>,
    functionModuleName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['run'], IAdtError>>;
  override async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'unitTestRun'>,
    _functionModuleName: string,
    _options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E | IAdtError>> {
    return failed<T['run']>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message:
        "run: a legacy system has no /sap/bc/adt/abapunit/runs, and its /sap/bc/adt/abapunit/testruns needs the module's URI, which lies under its function group — use runSync({ functionGroupName, functionModuleName }).",
    });
  }

  override getStatus<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'unitTestStatus'>,
    runId: string,
    withLongPolling: boolean | undefined,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['status'], E | IAdtError>>;
  override getStatus(
    this: this & AdtPerformedBy<'functionModule', 'unitTestStatus'>,
    runId: string,
    withLongPolling?: boolean | undefined,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['status'], IAdtError>>;
  override async getStatus<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'unitTestStatus'>,
    _runId: string,
    _withLongPolling?: boolean | undefined,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['status'], E | IAdtError>> {
    return noRunToPoll<T['status']>();
  }

  override getResult<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'unitTestResult'>,
    runId: string,
    options: IUnitTestResultOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['result'], E | IAdtError>>;
  override getResult(
    this: this & AdtPerformedBy<'functionModule', 'unitTestResult'>,
    runId: string,
    options?: IUnitTestResultOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['result'], IAdtError>>;
  override async getResult<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'unitTestResult'>,
    _runId: string,
    _options?: IUnitTestResultOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['result'], E | IAdtError>> {
    return noResultToFetch<T['result']>();
  }
}
