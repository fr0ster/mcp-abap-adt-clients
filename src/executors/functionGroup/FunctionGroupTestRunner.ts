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
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAdtRunnable,
  IClassUnitTestRunOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  AbapUnitRunner,
  abapUnitRunnerDocuments,
  type IAbapUnitRunnerResults,
  refusedBelow750,
} from '../abapUnitRunner';

export type IFunctionGroupTestRunnerResults = IAbapUnitRunnerResults;
export const functionGroupTestRunnerDocuments = abapUnitRunnerDocuments;

export class FunctionGroupTestRunner<
    R extends
      IFunctionGroupTestRunnerResults = typeof functionGroupTestRunnerDocuments,
  >
  extends AbapUnitRunner<R>
  implements
    IAdtRunnable<string, ReturnType<R['run']>, IClassUnitTestRunOptions>
{
  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    results: R = functionGroupTestRunnerDocuments as unknown as R,
  ) {
    super(connection, logger, results);
  }

  /** Run every test class of the group. One POST. */
  async run<E extends IAdtError = IAdtError>(
    functionGroupName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return this.startByObject(functionGroupName, 'FUGR', options);
  }
}

/**
 * Below 7.50: refused without a request, as a report's run is — the legacy
 * endpoint has not been measured to find a group's tests.
 */
export class FunctionGroupTestRunnerLegacy<
  R extends
    IFunctionGroupTestRunnerResults = typeof functionGroupTestRunnerDocuments,
> extends FunctionGroupTestRunner<R> {
  override async run<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['run']>, E>
  > {
    return refusedBelow750<ReturnType<R['run']>, E>("a function group's");
  }

  override async getStatus<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['status']>, E>
  > {
    return refusedBelow750<ReturnType<R['status']>, E>("a function group's");
  }

  override async getResult<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['result']>, E>
  > {
    return refusedBelow750<ReturnType<R['result']>, E>("a function group's");
  }
}
