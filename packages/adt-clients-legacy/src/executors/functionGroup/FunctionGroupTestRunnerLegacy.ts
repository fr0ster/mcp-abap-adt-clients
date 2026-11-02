/**
 * FunctionGroupTestRunnerLegacy — a function group's ABAP Unit tests on a
 * legacy system (SAP_BASIS 7.40, measured on 7.40 SP04), which has no `/sap/bc/adt/abapunit/runs`.
 *
 * `runSync` is the inherited one: `/sap/bc/adt/abapunit/testruns` given the
 * group's URI, with `<options>`, answered the finished result on 7.40 SP04.
 * `run` sends the same request, read by the `run` strategy — on 7.40 that POST
 * is the run. There is no run id, so `getStatus` and `getResult` are refused.
 */

import {
  type AbapUnitRunnerValues,
  type AdtPerformedBy,
  FUNCTION_GROUP,
  FunctionGroupTestRunner,
  type functionGroupTestRunnerDocuments,
  type ResultValuesOf,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IClassUnitTestRunOptions,
} from '@mcp-abap-adt/interfaces-adt';
import {
  noResultToFetch,
  noRunToPoll,
  runSyncLegacy,
} from '../abapUnitRunLegacy';

export class FunctionGroupTestRunnerLegacy<
  T extends AbapUnitRunnerValues = ResultValuesOf<
    typeof functionGroupTestRunnerDocuments
  >,
> extends FunctionGroupTestRunner<T, 'basis740'> {
  /** Run every test class of the group: the `runSync` request, read by `run`. */
  override async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'unitTestRun'>,
    functionGroupName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E>> {
    return runSyncLegacy(
      this.connection,
      [FUNCTION_GROUP.uri(functionGroupName)],
      this.results.run,
      options,
    );
  }

  override async getStatus<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'unitTestStatus'>,
  ): Promise<IAdtResponse<T['status'], E>> {
    return noRunToPoll<T['status'], E>();
  }

  override async getResult<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'unitTestResult'>,
  ): Promise<IAdtResponse<T['result'], E>> {
    return noResultToFetch<T['result'], E>();
  }
}
