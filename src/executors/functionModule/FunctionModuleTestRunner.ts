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
}

/**
 * Below 7.50: refused without a request, as a report's run is — the legacy
 * endpoint has not been measured to find a module's tests.
 */
export class FunctionModuleTestRunnerLegacy<
  R extends
    IFunctionModuleTestRunnerResults = typeof functionModuleTestRunnerDocuments,
> extends FunctionModuleTestRunner<R> {
  override async run<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['run']>, E>
  > {
    return refusedBelow750<ReturnType<R['run']>, E>("a function module's");
  }

  override async getStatus<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['status']>, E>
  > {
    return refusedBelow750<ReturnType<R['status']>, E>("a function module's");
  }

  override async getResult<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['result']>, E>
  > {
    return refusedBelow750<ReturnType<R['result']>, E>("a function module's");
  }
}
