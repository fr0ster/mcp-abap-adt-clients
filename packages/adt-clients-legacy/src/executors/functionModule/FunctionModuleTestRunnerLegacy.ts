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
import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { noResultToFetch, noRunToPoll } from '../abapUnitRunLegacy';

export class FunctionModuleTestRunnerLegacy<
  T extends AbapUnitRunnerValues = ResultValuesOf<
    typeof functionModuleTestRunnerDocuments
  >,
> extends FunctionModuleTestRunner<T, 'basis740'> {
  /** Refused without a request: see the class's comment. */
  override async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'unitTestRun'>,
  ): Promise<IAdtResponse<T['run'], E>> {
    return failed<T['run'], E>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message:
        "run: a legacy system has no /sap/bc/adt/abapunit/runs, and its /sap/bc/adt/abapunit/testruns needs the module's URI, which lies under its function group — use runSync({ functionGroupName, functionModuleName }).",
    } as E);
  }

  override async getStatus<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'unitTestStatus'>,
  ): Promise<IAdtResponse<T['status'], E>> {
    return noRunToPoll<T['status'], E>();
  }

  override async getResult<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'unitTestResult'>,
  ): Promise<IAdtResponse<T['result'], E>> {
    return noResultToFetch<T['result'], E>();
  }
}
