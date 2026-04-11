/**
 * GatewayErrorLog - Domain object for /IWFND/ERROR_LOG
 *
 * Provides list and detail access to SAP Gateway error log entries.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IFeedQueryOptions,
  IGatewayErrorLog,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { getGatewayError, listGatewayErrors } from './read';

export class GatewayErrorLog implements IGatewayErrorLog {
  readonly kind = 'gatewayErrorLog' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IFeedQueryOptions): Promise<AxiosResponse> {
    return listGatewayErrors(this.connection, options);
  }

  async getById(errorType: string, errorId: string): Promise<AxiosResponse> {
    return getGatewayError(this.connection, errorType, errorId);
  }
}
