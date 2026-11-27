/** The base's receiver of `run`, `getStatus` and `getResult`: a system that serves `/abapunit/runs`. */
type OnRunsEndpoint = IAdtServedOn<AdtModernVariant>;

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
import type {
  AbapUnitRunTarget,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
  IClassUnitTestRunOptions,
  IUnitTestResultOptions,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { noResultToFetch, noRunToPoll } from '../abapUnitRunLegacy';

export class AbapUnitTestRunnerLegacy<
  T extends AbapUnitRunnerValues = ResultValuesOf<
    typeof abapUnitTestRunnerDocuments
  >,
> extends AbapUnitTestRunner<T, 'basis740'> {
  /** Refused without a request: see the class's comment. */
  override run<E extends IAdtError>(
    this: this & OnRunsEndpoint,
    target: AbapUnitRunTarget,
    options: IClassUnitTestRunOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['run'], E | IAdtError>>;
  override run(
    this: this & OnRunsEndpoint,
    target: AbapUnitRunTarget,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['run'], IAdtError>>;
  override async run<E extends IAdtError = IAdtError>(
    this: this & OnRunsEndpoint,
    _target: AbapUnitRunTarget,
    _options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E | IAdtError>> {
    return failed<T['run']>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message:
        'run: a legacy system has no /sap/bc/adt/abapunit/runs, where an object or a package target runs — name the objects by their ADT URIs with runSync, which runs on /sap/bc/adt/abapunit/testruns.',
    });
  }

  override getStatus<E extends IAdtError>(
    this: this & OnRunsEndpoint,
    runId: string,
    withLongPolling: boolean | undefined,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['status'], E | IAdtError>>;
  override getStatus(
    this: this & OnRunsEndpoint,
    runId: string,
    withLongPolling?: boolean | undefined,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['status'], IAdtError>>;
  override async getStatus<E extends IAdtError = IAdtError>(
    this: this & OnRunsEndpoint,
    _runId: string,
    _withLongPolling?: boolean | undefined,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['status'], E | IAdtError>> {
    return noRunToPoll<T['status']>();
  }

  override getResult<E extends IAdtError>(
    this: this & OnRunsEndpoint,
    runId: string,
    options: IUnitTestResultOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['result'], E | IAdtError>>;
  override getResult(
    this: this & OnRunsEndpoint,
    runId: string,
    options?: IUnitTestResultOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['result'], IAdtError>>;
  override async getResult<E extends IAdtError = IAdtError>(
    this: this & OnRunsEndpoint,
    _runId: string,
    _options?: IUnitTestResultOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['result'], E | IAdtError>> {
    return noResultToFetch<T['result']>();
  }
}
