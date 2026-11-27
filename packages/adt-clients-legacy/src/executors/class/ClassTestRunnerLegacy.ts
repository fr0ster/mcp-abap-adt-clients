/**
 * ClassTestRunnerLegacy — running ABAP Unit on legacy SAP systems (SAP_BASIS 7.40, measured on 7.40 SP04).
 *
 * 7.40 has no `/sap/bc/adt/abapunit/runs`; `/sap/bc/adt/abapunit/testruns`
 * runs the tests and answers the finished result (`aunit:runResult`), so there
 * is no run to poll. `runSync` is the inherited one — measured on 7.40 SP04,
 * `<options>` included — and `run` sends the same request, read by the `run`
 * strategy.
 *
 * The format addresses classes, never a test class inside one, so a run given
 * test definitions runs each distinct container whole.
 */

import {
  type AbapUnitRunnerValues,
  type AdtPerformedBy,
  answering,
  ClassTestRunner,
  type classTestRunnerDocuments,
  containersOf,
  type IClassTestRunTarget,
  type ResultValuesOf,
  startClassUnitTestRunSync,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
  IClassUnitTestRunOptions,
  IUnitTestResultOptions,
} from '@mcp-abap-adt/interfaces-adt';
import { noResultToFetch, noRunToPoll } from '../abapUnitRunLegacy';

export class ClassTestRunnerLegacy<
  T extends AbapUnitRunnerValues = ResultValuesOf<
    typeof classTestRunnerDocuments
  >,
> extends ClassTestRunner<T, 'basis740'> {
  /**
   * Run the tests. On a legacy system the POST answers the finished result:
   * the request `runSync` sends, with `<options>` — the caller's scope, risk
   * levels and durations — read by this runner's `run` strategy as it came.
   */
  override run<E extends IAdtError>(
    this: this & AdtPerformedBy<'class', 'unitTestRun'>,
    target: IClassTestRunTarget,
    options: IClassUnitTestRunOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['run'], E | IAdtError>>;
  override run(
    this: this & AdtPerformedBy<'class', 'unitTestRun'>,
    target: IClassTestRunTarget,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['run'], IAdtError>>;
  override async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'unitTestRun'>,
    target: IClassTestRunTarget,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E | IAdtError>> {
    const { analyse, ...runOptions } = options ?? {};
    return answering(
      () =>
        startClassUnitTestRunSync(
          this.connection,
          containersOf(target),
          runOptions,
        ),
      this.results.run,
      analyse,
    );
  }

  /**
   * Refused without a request: a legacy system finishes a run before it
   * answers and exposes no run to poll. `run`'s own answer is the result.
   */
  override getStatus<E extends IAdtError>(
    this: this & AdtPerformedBy<'class', 'unitTestStatus'>,
    runId: string,
    withLongPolling: boolean | undefined,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['status'], E | IAdtError>>;
  override getStatus(
    this: this & AdtPerformedBy<'class', 'unitTestStatus'>,
    runId: string,
    withLongPolling?: boolean | undefined,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['status'], IAdtError>>;
  override async getStatus<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'unitTestStatus'>,
    _runId: string,
    _withLongPolling?: boolean | undefined,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['status'], E | IAdtError>> {
    return noRunToPoll<T['status']>();
  }

  /** Refused for the same reason: `run`'s answer is the result document. */
  override getResult<E extends IAdtError>(
    this: this & AdtPerformedBy<'class', 'unitTestResult'>,
    runId: string,
    options: IUnitTestResultOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['result'], E | IAdtError>>;
  override getResult(
    this: this & AdtPerformedBy<'class', 'unitTestResult'>,
    runId: string,
    options?: IUnitTestResultOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['result'], IAdtError>>;
  override async getResult<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'unitTestResult'>,
    _runId: string,
    _options?: IUnitTestResultOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['result'], E | IAdtError>> {
    return noResultToFetch<T['result']>();
  }
}
