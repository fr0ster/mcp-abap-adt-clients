/**
 * FunctionModuleTestRunner — running the ABAP Unit tests of one function
 * module, and asking about the run.
 *
 * The test classes live in an include of the module's group; which of them
 * belong to this module is ADT's to decide.
 *
 * Measured on premise (2026-09-30): `POST /abapunit/runs` naming the module as
 * `osl:object type="FUNC"` — what Eclipse sends — ran the seven test methods
 * that exercise it, and answered an empty result for another module of the
 * same group that none of them exercises. The whole group's tests are
 * `FunctionGroupTestRunner`.
 *
 * Measured on premise again (SAP_BASIS 816, 2026-10-23), with a group whose
 * test include holds one test class that calls the module and one that calls
 * no module: `run` (`FUNC`) ran every test of the group — both classes — and
 * so did the run of a second module that no test calls. That does not
 * reproduce the 2026-09-30 filter; what made the difference is not known.
 * Which tests a module's run covers is ADT's to decide, and nothing here
 * filters them.
 *
 * On a legacy system (7.40 SP04, no `/abapunit/runs`),
 * `FunctionModuleTestRunnerLegacy` sends this `/testruns` request
 * with `<options>` from `runSync`, as it is here. Its `run` is refused (it names
 * no group), and so are `getStatus` and `getResult` (there is no run id).
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAdtRunnable,
  IClassUnitTestRunOptions,
  IFunctionModuleConfig,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { FUNCTION_MODULE } from '../../endpoints/objects';
import {
  AbapUnitRunner,
  abapUnitRunnerDocuments,
  type IAbapUnitRunnerResults,
} from '../abapUnitRunner';

/**
 * What `runSync` is given: the module and its group — the module's URI, which
 * `/abapunit/testruns` addresses, lies under its group's.
 */
export type IFunctionModuleTestRunSyncTarget = Pick<
  IFunctionModuleConfig,
  'functionGroupName' | 'functionModuleName'
>;

export type IFunctionModuleTestRunnerResults = IAbapUnitRunnerResults;
export const functionModuleTestRunnerDocuments = abapUnitRunnerDocuments;

export class FunctionModuleTestRunner<
    R extends
      IFunctionModuleTestRunnerResults = typeof functionModuleTestRunnerDocuments,
  >
  extends AbapUnitRunner<R>
  implements
    IAdtRunnable<string, ReturnType<R['run']>, IClassUnitTestRunOptions>
{
  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    results: R = functionModuleTestRunnerDocuments as unknown as R,
  ) {
    super(connection, logger, results);
  }

  /** Run the test classes that exercise the module. One POST. */
  async run<E extends IAdtError = IAdtError>(
    functionModuleName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return this.startByObject(functionModuleName, 'FUNC', options);
  }

  /**
   * Run the module's tests and answer the finished result. One POST, to
   * `/sap/bc/adt/abapunit/testruns` — the synchronous runner, beside the
   * asynchronous `run` + `getStatus` + `getResult`, which stays the default.
   *
   * An explicit choice of the caller's: nothing here asks the system which
   * runner it has. The module is named by its URI, which lies under its
   * group's, so the target names both. The run configuration always carries
   * `<options>` (scope, risk levels and durations, with `run`'s defaults) —
   * without it the endpoint answered an empty result. `title` and `context`
   * are not sent.
   *
   * **It does not keep to the module's tests.** Measured on premise
   * (SAP_BASIS 816, 2026-10-23): the module's URI ran every test of its group —
   * the result names the group (`adtcore:type="FUGR/F"`) — including a test
   * class that calls no module, and the run of a module that no test calls
   * answered the same. `run` answered the same there too. Nothing here filters
   * the result; a caller who wants one module's tests reads them out of it.
   *
   * With an ABAP Doc test relation (`"! @testing FUNC:<module>`) on a test
   * class of the group, the same request with the default scope answered the
   * group's tests as a preview — `isForeign="true"`, nothing executed, no
   * alerts — and with `scope: { foreignTests: true }` ran them all (measured
   * once, 2026-10-23, same system).
   *
   * The answer is the `aunit:runResult` document, read by this runner's
   * `result` strategy; whether a failing test is a failure is
   * `options.analyse`'s.
   */
  async runSync<E extends IAdtError = IAdtError>(
    target: IFunctionModuleTestRunSyncTarget,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['result']>, E>> {
    return this.startSync(
      [
        FUNCTION_MODULE.uri(
          target.functionGroupName,
          target.functionModuleName,
        ),
      ],
      options,
    );
  }
}
