/**
 * ClassTestRunner — running the ABAP Unit tests of a class, and asking about
 * the run.
 *
 * A unit test is not an object type. It is a local test class, and it lives in
 * the `testclasses` include of a global class — the class under test, or a
 * container written for the purpose, which is what a CDS view's tests need
 * because a view cannot hold a class. Writing that include is
 * `AdtClient.getLocalTestClass()`; creating a container is `getClass()`. What
 * is left is executing it, and executing is an executor's, beside the class's
 * other executor (`ClassExecutor`, which runs `if_oo_adt_classrun`).
 *
 * Until 24.0.0 this was `AdtClient.getUnitTest()` and `getCdsUnitTest()`: two
 * handlers named after something that is not an object, re-exporting the local
 * test class's CRUD and the class's create under a second name, with two
 * byte-identical copies of the run module behind them.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */

import type {
  AdtVariant,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAdtRunnable,
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import {
  startClassUnitTestRun,
  startClassUnitTestRunSync,
} from '../../core/class/run';
import { answering } from '../../utils/adtResponse';
import {
  AbapUnitRunner,
  abapUnitRunnerDocuments,
  type IAbapUnitRunnerResults,
} from '../abapUnitRunner';

/**
 * What a run is given: named test classes in their containers, or one class
 * whose every test class runs.
 */
export type IClassTestRunTarget = IClassUnitTestDefinition[] | string;

/** The distinct containers a target names: what `/testruns` addresses. */
export function containersOf(target: IClassTestRunTarget): string[] {
  return typeof target === 'string'
    ? [target]
    : [...new Set(target.map((test) => test.containerClass))];
}

/**
 * One strategy per distinct answer: starting a run, polling it, its result.
 * `runSync` answers the result document itself, so it is read by `result`.
 */
export type IClassTestRunnerResults = IAbapUnitRunnerResults;

/** The shipped default: documents as they arrived. */
export const classTestRunnerDocuments = abapUnitRunnerDocuments;

export class ClassTestRunner<
    R extends IClassTestRunnerResults = typeof classTestRunnerDocuments,
    V extends AdtVariant = AdtModernVariant,
  >
  extends AbapUnitRunner<R, V, 'class'>
  implements
    IAdtRunnable<
      IClassTestRunTarget,
      ReturnType<R['run']>,
      IClassUnitTestRunOptions
    >
{
  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    results: R = classTestRunnerDocuments as unknown as R,
  ) {
    super(connection, logger, results);
  }

  /**
   * Run the tests. One POST.
   *
   * Needs no write before it: the tests may have been in the class for years.
   * A class name runs every test class in it, by object — `osl:object
   * type="CLAS"`, what Eclipse sends; an array runs the named test classes in
   * their containers. The run's id is in a header of the answer — construct
   * this with `unitTestRunId` from @mcp-abap-adt/adt-strategies for `run` to be
   * answered the id, and pass `analyseUnitTestStart` to have an id-less answer
   * read as a failure.
   */
  async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'unitTestRun'>,
    target: IClassTestRunTarget,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    if (typeof target === 'string') {
      return this.startByObject(target, 'CLAS', options);
    }
    return answering(
      () => startClassUnitTestRun(this.connection, target, options),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      options?.analyse,
    );
  }

  /**
   * Run the tests and answer the finished result. One POST, to
   * `/sap/bc/adt/abapunit/testruns` — the synchronous runner, beside the
   * asynchronous `run` + `getStatus` + `getResult`, which stays the default.
   *
   * An explicit choice of the caller's: nothing here asks the system which
   * runner it has. A system without `/abapunit/runs` (an on-prem S/4HANA 2023
   * was measured with `/testruns` alone) needs this one; whether a system has
   * it is in its discovery, which is the caller's to read.
   *
   * The answer is the `aunit:runResult` document, so it is read by this
   * runner's `result` strategy — the one `getResult` uses — and a failing test
   * is in it as an `alert`; whether that is a failure is `options.analyse`'s
   * (`analyseUnitTest` from @mcp-abap-adt/adt-strategies reads it so).
   *
   * Differences from `run`: the endpoint addresses whole classes, so a target
   * of test definitions runs each distinct container whole, and `title` and
   * `context` are not sent; scope, risk levels and durations are, with the
   * same defaults.
   */
  async runSync<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'unitTestRunSync'>,
    target: IClassTestRunTarget,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['result']>, E>> {
    const { analyse, ...runOptions } = options ?? {};
    return answering(
      () =>
        startClassUnitTestRunSync(
          this.connection,
          containersOf(target),
          runOptions,
        ),
      this.results.result as IResultStrategy<ReturnType<R['result']>>,
      analyse,
    );
  }
}
