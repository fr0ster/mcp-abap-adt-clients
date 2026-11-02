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
import type { AdtLoggedOptions } from '../../core/shared/handlerOptions';
import { answering } from '../../utils/adtResponse';
import {
  type ResultStrategiesOf,
  type ResultValuesOf,
  rawDocument,
} from '../../utils/resultStrategy';
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

/** What each slot of the result set answers. */
export type AtcLogValues = {
  readonly [K in keyof IAtcLogResults]: unknown;
};

export class AtcLog<
  T extends AtcLogValues = ResultValuesOf<typeof atcLogDocuments>,
> implements IAtcLog<T['checkFailures'], T['executionLog']>
{
  readonly kind = 'atcLog' as const;

  private readonly results: ResultStrategiesOf<T>;
  private readonly logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this.logger = options.logger;
    this.results = options.results;
  }

  async getCheckFailureLogs<E extends IAdtError = IAdtError>(
    options?: IGetCheckFailureLogsOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['checkFailures'], E>> {
    return answering(
      () => getCheckFailureLogs(this.connection, options),
      this.results.checkFailures,
      options?.analyse,
    );
  }

  async getExecutionLog<E extends IAdtError = IAdtError>(
    executionId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['executionLog'], E>> {
    return answering(
      () => getExecutionLog(this.connection, executionId),
      this.results.executionLog,
      options?.analyse,
    );
  }
}
