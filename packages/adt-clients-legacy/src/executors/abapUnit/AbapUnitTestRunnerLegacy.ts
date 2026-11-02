/**
 * AbapUnitTestRunnerLegacy — the generic ABAP Unit runner on a legacy system
 * (SAP_BASIS 7.40, measured on 7.40 SP04), which has no
 * `/sap/bc/adt/abapunit/runs` and no `/abapunit/metadata`.
 *
 * `runSync` is the inherited one: `/sap/bc/adt/abapunit/testruns`, objects by
 * their ADT URIs, with `<options>` — the request measured on 7.40 SP04 for a
 * class, a report, a function group and a function module. `run` is refused
 * without a request for an object target and a package target alike: both
 * name a run on `/runs`, and `/testruns` has no form for either (it names
 * objects by URI, not by `osl:object type`, and has no package set). There is
 * no run id, so `getStatus` and `getResult` are refused too. Each refusal is
 * for a caller outside the type system: on `'basis740'` none of the three
 * compiles.
 */

import {
  type AbapUnitRunnerValues,
  AbapUnitTestRunner,
  type AdtModernVariant,
  type abapUnitTestRunnerDocuments,
  failed,
  type IAdtServedOn,
  type ResultValuesOf,
} from '@mcp-abap-adt/adt-clients';
import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { noResultToFetch, noRunToPoll } from '../abapUnitRunLegacy';

export class AbapUnitTestRunnerLegacy<
  T extends AbapUnitRunnerValues = ResultValuesOf<
    typeof abapUnitTestRunnerDocuments
  >,
> extends AbapUnitTestRunner<T, 'basis740'> {
  /** Refused without a request: see the class's comment. */
  override async run<E extends IAdtError = IAdtError>(
    this: this & IAdtServedOn<AdtModernVariant>,
  ): Promise<IAdtResponse<T['run'], E>> {
    return failed<T['run'], E>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message:
        'run: a legacy system has no /sap/bc/adt/abapunit/runs, where an object or a package target runs — name the objects by their ADT URIs with runSync, which runs on /sap/bc/adt/abapunit/testruns.',
    } as E);
  }

  override async getStatus<E extends IAdtError = IAdtError>(
    this: this & IAdtServedOn<AdtModernVariant>,
  ): Promise<IAdtResponse<T['status'], E>> {
    return noRunToPoll<T['status'], E>();
  }

  override async getResult<E extends IAdtError = IAdtError>(
    this: this & IAdtServedOn<AdtModernVariant>,
  ): Promise<IAdtResponse<T['result'], E>> {
    return noResultToFetch<T['result'], E>();
  }
}
