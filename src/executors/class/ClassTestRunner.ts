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
import { startClassUnitTestRun } from '../../core/class/run';
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

/** One strategy per distinct answer: starting a run, polling it, its result. */
export type IClassTestRunnerResults = IAbapUnitRunnerResults;

/** The shipped default: documents as they arrived. */
export const classTestRunnerDocuments = abapUnitRunnerDocuments;

export class ClassTestRunner<
    R extends IClassTestRunnerResults = typeof classTestRunnerDocuments,
  >
  extends AbapUnitRunner<R>
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
}
