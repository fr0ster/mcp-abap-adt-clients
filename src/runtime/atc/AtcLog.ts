import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAtcLog,
  IGetCheckFailureLogsOptions,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import { getCheckFailureLogs, getExecutionLog } from './logs';

/** One strategy per member of the ATC logs. */
export interface IAtcLogResults {
  readonly checkFailures: IResultStrategy<unknown>;
  readonly executionLog: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const atcLogDocuments = {
  checkFailures: rawDocument,
  executionLog: rawDocument,
} satisfies IAtcLogResults;

export class AtcLog<R extends IAtcLogResults = typeof atcLogDocuments>
  implements
    IAtcLog<ReturnType<R['checkFailures']>, ReturnType<R['executionLog']>>
{
  readonly kind = 'atcLog' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = atcLogDocuments as unknown as R,
  ) {}

  async getCheckFailureLogs<E extends IAdtError = IAdtError>(
    options?: IGetCheckFailureLogsOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['checkFailures']>, E>> {
    return answering(
      () => getCheckFailureLogs(this.connection, options),
      this.results.checkFailures as IResultStrategy<
        ReturnType<R['checkFailures']>
      >,
      options?.analyse,
    );
  }

  async getExecutionLog<E extends IAdtError = IAdtError>(
    executionId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['executionLog']>, E>> {
    return answering(
      () => getExecutionLog(this.connection, executionId),
      this.results.executionLog as IResultStrategy<
        ReturnType<R['executionLog']>
      >,
      options?.analyse,
    );
  }
}
