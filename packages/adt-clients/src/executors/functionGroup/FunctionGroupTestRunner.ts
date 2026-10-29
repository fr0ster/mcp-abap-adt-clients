/**
 * FunctionGroupTestRunner — running every ABAP Unit test of a function group,
 * and asking about the run.
 *
 * A group's test classes are local classes in one of its includes, pulled into
 * the group's main program; writing them is `getFunctionInclude().update()`.
 *
 * Measured on premise (2026-09-30): `POST /abapunit/runs` naming the group as
 * `osl:object type="FUGR"` ran all seven test methods of a group whose test
 * include covers two test classes. Running one module's tests only is
 * `FunctionModuleTestRunner`.
 *
 * Measured on premise (SAP_BASIS 816, 2026-10-23): `/abapunit/testruns` given
 * the group's URI runs the same tests with the same alerts as `/runs` — with
 * the Eclipse-style `<options>` only; without it, an empty result. `runSync`
 * always sends `<options>`.
 */

import type {
  AdtVariant,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAdtRunnable,
  IClassUnitTestRunOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import type { AdtHandlerOptions } from '../../core/shared/handlerOptions';
import { FUNCTION_GROUP } from '../../endpoints/objects';
import {
  AbapUnitRunner,
  abapUnitRunnerDocuments,
  type IAbapUnitRunnerResults,
} from '../abapUnitRunner';

export type IFunctionGroupTestRunnerResults = IAbapUnitRunnerResults;
export const functionGroupTestRunnerDocuments = abapUnitRunnerDocuments;

export class FunctionGroupTestRunner<
    R extends
      IFunctionGroupTestRunnerResults = typeof functionGroupTestRunnerDocuments,
    V extends AdtVariant = AdtModernVariant,
  >
  extends AbapUnitRunner<R, V, 'functionGroup'>
  implements
    IAdtRunnable<string, ReturnType<R['run']>, IClassUnitTestRunOptions>
{
  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<R, 'logger'>,
  ) {
    super(connection, options);
  }

  /** Run every test class of the group. One POST. */
  async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'unitTestRun'>,
    functionGroupName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return this.startByObject(functionGroupName, 'FUGR', options);
  }

  /**
   * Run every test class of the group and answer the finished result. One
   * POST, to `/sap/bc/adt/abapunit/testruns` — the synchronous runner, beside
   * the asynchronous `run` + `getStatus` + `getResult`, which stays the
   * default.
   *
   * An explicit choice of the caller's: nothing here asks the system which
   * runner it has. The group is named by its URI and the run configuration
   * always carries `<options>` (scope, risk levels and durations, with `run`'s
   * defaults) — without it the endpoint answered an empty result for a group
   * with tests. `title` and `context` are not sent.
   *
   * The answer is the `aunit:runResult` document, read by this runner's
   * `result` strategy; whether a failing test is a failure is
   * `options.analyse`'s.
   */
  async runSync<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'unitTestRunSync'>,
    functionGroupName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['result']>, E>> {
    return this.startSync([FUNCTION_GROUP.uri(functionGroupName)], options);
  }
}
