/**
 * SystemMessages - Domain object for SM02 system messages
 *
 * Provides list and detail access to system messages.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IFeedQueryOptions,
  IResultStrategy,
  ISystemMessages,
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
import { getSystemMessage, listSystemMessages } from './read';

/** One strategy per member of the system messages. */
export interface ISystemMessagesResults {
  readonly list: IResultStrategy<unknown>;
  readonly message: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const systemMessagesDocuments = {
  list: rawDocument,
  message: rawDocument,
} satisfies ISystemMessagesResults;

/** What each slot of the result set answers. */
export type SystemMessagesValues = {
  readonly [K in keyof ISystemMessagesResults]: unknown;
};

/** The messages this system is showing. */
export class SystemMessages<
  T extends SystemMessagesValues = ResultValuesOf<
    typeof systemMessagesDocuments
  >,
> implements ISystemMessages<T['list'], T['message']>
{
  readonly kind = 'systemMessages' as const;
  private readonly results: ResultStrategiesOf<T>;
  private readonly logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this.logger = options.logger;
    this.results = options.results;
  }

  async list<E extends IAdtError = IAdtError>(
    options?: IFeedQueryOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['list'], E>> {
    return answering(
      () => listSystemMessages(this.connection, options),
      this.results.list,
      options?.analyse,
    );
  }

  async getById<E extends IAdtError = IAdtError>(
    messageId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['message'], E>> {
    return answering(
      () => getSystemMessage(this.connection, messageId),
      this.results.message,
      options?.analyse,
    );
  }
}
