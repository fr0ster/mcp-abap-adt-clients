/**
 * ProgramTestRunner — running the ABAP Unit tests of a report, and asking about
 * the run.
 *
 * A report's test classes are local classes in the report's own source or in
 * an include it pulls in; writing them is `getProgram().update()` or
 * `getInclude().update()`. What is left is executing them, and executing is an
 * executor's, beside the report's other executor (`ProgramExecutor`, which
 * runs the report itself through `programrun`).
 *
 * Measured on premise (2026-09-30): one `POST /abapunit/runs` naming the report
 * as `osl:object type="PROG"` runs its test classes wherever they sit — own
 * source or include. `/abapunit/testruns` given the report's URI answered an
 * empty result for the same report, so the legacy runner refuses rather than
 * send it (`ProgramTestRunnerLegacy`).
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
} from '../abapUnitRunner';

export type IProgramTestRunnerResults = IAbapUnitRunnerResults;
export const programTestRunnerDocuments = abapUnitRunnerDocuments;

export class ProgramTestRunner<
    R extends IProgramTestRunnerResults = typeof programTestRunnerDocuments,
  >
  extends AbapUnitRunner<R>
  implements
    IAdtRunnable<string, ReturnType<R['run']>, IClassUnitTestRunOptions>
{
  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    results: R = programTestRunnerDocuments as unknown as R,
  ) {
    super(connection, logger, results);
  }

  /** Run every test class of the report. One POST. */
  async run<E extends IAdtError = IAdtError>(
    programName: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return this.startByObject(programName, 'PROG', options);
  }
}
