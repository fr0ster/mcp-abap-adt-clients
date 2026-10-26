/**
 * ClassTestRunnerLegacy — running ABAP Unit on legacy SAP systems (BASIS < 7.50).
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

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IClassUnitTestRunOptions,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { startClassUnitTestRunSync } from '../../core/class/run';
import { answering } from '../../utils/adtResponse';
import { noResultToFetch, noRunToPoll } from '../abapUnitRunLegacy';
import {
  ClassTestRunner,
  type classTestRunnerDocuments,
  containersOf,
  type IClassTestRunnerResults,
  type IClassTestRunTarget,
} from './ClassTestRunner';

export class ClassTestRunnerLegacy<
  R extends IClassTestRunnerResults = typeof classTestRunnerDocuments,
> extends ClassTestRunner<R> {
  /**
   * Run the tests. On a legacy system the POST answers the finished result:
   * the request `runSync` sends, with `<options>` — the caller's scope, risk
   * levels and durations — read by this runner's `run` strategy as it came.
   */
  override async run<E extends IAdtError = IAdtError>(
    target: IClassTestRunTarget,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    const { analyse, ...runOptions } = options ?? {};
    return answering(
      () =>
        startClassUnitTestRunSync(
          this.connection,
          containersOf(target),
          runOptions,
        ),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      analyse,
    );
  }

  /**
   * Refused without a request: a legacy system finishes a run before it
   * answers and exposes no run to poll. `run`'s own answer is the result.
   */
  override async getStatus<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['status']>, E>
  > {
    return noRunToPoll<ReturnType<R['status']>, E>();
  }

  /** Refused for the same reason: `run`'s answer is the result document. */
  override async getResult<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['result']>, E>
  > {
    return noResultToFetch<ReturnType<R['result']>, E>();
  }
}
