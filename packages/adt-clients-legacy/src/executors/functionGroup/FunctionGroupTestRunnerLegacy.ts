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
  FUNCTION_GROUP,
  FunctionGroupTestRunner,
  type functionGroupTestRunnerDocuments,
  type IFunctionGroupTestRunnerResults,
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

export class FunctionGroupTestRunnerLegacy<
  R extends
    IFunctionGroupTestRunnerResults = typeof functionGroupTestRunnerDocuments,
> extends FunctionGroupTestRunner<R> {
  /** Run every test class of the group: the `runSync` request, read by `run`. */
  override async run<E extends IAdtError = IAdtError>(
    functionGroupName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return runSyncLegacy(
      this.connection,
      [FUNCTION_GROUP.uri(functionGroupName)],
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
