/**
 * SystemMessages - Domain object for SM02 system messages
 *
 * Provides the list of system messages. SAP routes no single message
 * (`CL_STSK_ADT_RES_APP->register_resources`, l. 31-48), so there is no
 * `getById` (removed in 47.0.0), and since interfaces-adt 31.0.0
 * `ISystemMessages<TList>` declares none.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
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
import { listSystemMessages } from './read';

/** One strategy per member of the system messages. */
export interface ISystemMessagesResults {
  readonly list: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const systemMessagesDocuments = {
  list: rawDocument,
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
> implements ISystemMessages<T['list']>
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

  list<E extends IAdtError>(
    options: IFeedQueryOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['list'], E | IAdtError>>;
  list(
    options?: IFeedQueryOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['list'], IAdtError>>;
  async list<E extends IAdtError = IAdtError>(
    options?: IFeedQueryOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['list'], E | IAdtError>> {
    return answering(
      () => listSystemMessages(this.connection, options),
      this.results.list,
      options?.analyse,
    );
  }
}
