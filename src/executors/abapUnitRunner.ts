/**
 * What every ABAP Unit runner shares: asking about a run by its id, and
 * starting one for a single object of the runner's type.
 *
 * A runner is per object type — class, report, function group, function
 * module — because the library groups by the object a request touches. What
 * differs between them is one attribute of the start request, the `type` of
 * the `osl:object` it names (see `core/shared/abapUnit`); the run id that comes
 * back knows no type, so polling and fetching are here once.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IClassUnitTestRunOptions,
  IResultStrategy,
  ITestRunInformation,
  IUnitTestResultOptions,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  getUnitTestRunResult,
  getUnitTestRunStatus,
  startUnitTestRunByObject,
} from '../core/shared/abapUnit';
import { answering, failed } from '../utils/adtResponse';
import { rawDocument } from '../utils/resultStrategy';

/** One strategy per distinct answer: starting a run, polling it, its result. */
export interface IAbapUnitRunnerResults {
  /** What starting a run answers. `unitTestRunId` in adt-strategies reads the id. */
  readonly run: IResultStrategy<unknown>;
  /** What polling a run answers. */
  readonly status: IResultStrategy<unknown>;
  /** What a finished run's result document answers. */
  readonly result: IResultStrategy<unknown>;
}

/**
 * The shipped default: documents as they arrived. A run's id is in a header of
 * the start's answer, not its body, so a caller who wants it passes
 * `unitTestRunId` from @mcp-abap-adt/adt-strategies for `run`.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const abapUnitRunnerDocuments = {
  run: rawDocument,
  status: rawDocument,
  result: rawDocument,
} satisfies IAbapUnitRunnerResults;

export abstract class AbapUnitRunner<R extends IAbapUnitRunnerResults>
  implements
    ITestRunInformation<ReturnType<R['status']>, ReturnType<R['result']>>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly results: R;

  constructor(
    connection: IAbapConnection,
    logger: ILogger | undefined,
    results: R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.results = results;
  }

  /** Start a run of every test class the one named object holds. */
  protected startByObject<E extends IAdtError>(
    name: string,
    type: string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return answering(
      () => startUnitTestRunByObject(this.connection, { name, type }, options),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      options?.analyse,
    );
  }

  /**
   * Poll a run. Takes the run it is about: nothing here remembers the last one
   * started, because ADT does not either — any holder of the id may ask.
   */
  async getStatus<E extends IAdtError = IAdtError>(
    runId: string,
    withLongPolling: boolean | undefined = true,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['status']>, E>> {
    return answering(
      () =>
        getUnitTestRunStatus(this.connection, runId, withLongPolling ?? true),
      this.results.status as IResultStrategy<ReturnType<R['status']>>,
      options?.analyse,
    );
  }

  /** The result document of a finished run. */
  async getResult<E extends IAdtError = IAdtError>(
    runId: string,
    options?: IUnitTestResultOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['result']>, E>> {
    return answering(
      () => getUnitTestRunResult(this.connection, runId, options),
      this.results.result as IResultStrategy<ReturnType<R['result']>>,
      options?.analyse,
    );
  }
}

/**
 * The refusal a legacy runner answers without a request, for an object type
 * whose tests no measured legacy endpoint runs.
 */
export function refusedBelow750<T, E extends IAdtError>(
  what: string,
): IAdtResponse<T, E> {
  return failed<T, E>({
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message: `Running ${what} ABAP Unit tests is not supported below BASIS 7.50: the legacy endpoint answered no tests where there are some.`,
  } as E);
}
