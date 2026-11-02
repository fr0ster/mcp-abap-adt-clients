/**
 * GatewayErrorLog - Domain object for /IWFND/ERROR_LOG
 *
 * Provides list and detail access to SAP Gateway error log entries.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IFeedQueryOptions,
  IGatewayErrorLog,
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
import { getGatewayError, listGatewayErrors } from './read';

/** One strategy per member of the gateway error log. */
export interface IGatewayErrorLogResults {
  readonly list: IResultStrategy<unknown>;
  readonly error: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const gatewayErrorLogDocuments = {
  list: rawDocument,
  error: rawDocument,
} satisfies IGatewayErrorLogResults;

/** What each slot of the result set answers. */
export type GatewayErrorLogValues = {
  readonly [K in keyof IGatewayErrorLogResults]: unknown;
};

/**
 * The gateway error log.
 *
 * Both members answer their document by default. The shapes a consumer may
 * read it into are strategies in `@mcp-abap-adt/adt-strategies`
 * (`feedGatewayErrors`, `feedGatewayErrorDetail`) — measured, but not imposed,
 * because a caller reading one error out of a list wants the list, not every
 * field of every entry.
 */
export class GatewayErrorLog<
  T extends GatewayErrorLogValues = ResultValuesOf<
    typeof gatewayErrorLogDocuments
  >,
> implements IGatewayErrorLog<T['list'], T['error']>
{
  readonly kind = 'gatewayErrorLog' as const;
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
      () => listGatewayErrors(this.connection, options),
      this.results.list,
      options?.analyse,
    );
  }

  async getById<E extends IAdtError = IAdtError>(
    errorType: string,
    errorId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['error'], E>> {
    return answering(
      () => getGatewayError(this.connection, errorType, errorId),
      this.results.error,
      options?.analyse,
    );
  }
}
