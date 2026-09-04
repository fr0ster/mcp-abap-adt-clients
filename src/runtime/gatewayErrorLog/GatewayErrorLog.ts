/**
 * GatewayErrorLog - Domain object for /IWFND/ERROR_LOG
 *
 * Provides list and detail access to SAP Gateway error log entries.
 */

import type {
  IAbapConnection,
  IAdtResponse,
  IFeedQueryOptions,
  IGatewayErrorLog,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import { getGatewayError, listGatewayErrors } from './read';

/**
 * The gateway error log.
 *
 * Both members answer their document. The shapes in `./types` are what a
 * consumer parses it into — this package has measured them but does not impose
 * them, because a caller reading one error out of a list wants the list, not
 * every field of every entry.
 */
export class GatewayErrorLog implements IGatewayErrorLog<string, string> {
  readonly kind = 'gatewayErrorLog' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IFeedQueryOptions): Promise<IAdtResponse<string>> {
    return answering(
      () => listGatewayErrors(this.connection, options),
      rawDocument,
    );
  }

  async getById(
    errorType: string,
    errorId: string,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getGatewayError(this.connection, errorType, errorId),
      rawDocument,
    );
  }
}
