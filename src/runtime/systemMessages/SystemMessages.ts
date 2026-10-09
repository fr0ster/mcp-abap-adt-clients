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
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
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

/** The messages this system is showing. */
export class SystemMessages<
  R extends ISystemMessagesResults = typeof systemMessagesDocuments,
> implements ISystemMessages<ReturnType<R['list']>, ReturnType<R['message']>>
{
  readonly kind = 'systemMessages' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = systemMessagesDocuments as unknown as R,
  ) {}

  async list<E extends IAdtError = IAdtError>(
    options?: IFeedQueryOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['list']>, E>> {
    return answering(
      () => listSystemMessages(this.connection, options),
      this.results.list as IResultStrategy<ReturnType<R['list']>>,
      options?.analyse,
    );
  }

  async getById<E extends IAdtError = IAdtError>(
    messageId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['message']>, E>> {
    return answering(
      () => getSystemMessage(this.connection, messageId),
      this.results.message as IResultStrategy<ReturnType<R['message']>>,
      options?.analyse,
    );
  }
}
