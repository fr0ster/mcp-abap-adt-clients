/**
 * SystemMessages - Domain object for SM02 system messages
 *
 * Provides list and detail access to system messages.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  IFeedQueryOptions,
  ILogger,
  ISystemMessages,
} from '@mcp-abap-adt/interfaces';
import { getSystemMessage, listSystemMessages } from './read';

export class SystemMessages implements ISystemMessages {
  readonly kind = 'systemMessages' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IFeedQueryOptions): Promise<IAdtWireResponse> {
    return listSystemMessages(this.connection, options);
  }

  async getById(messageId: string): Promise<IAdtWireResponse> {
    return getSystemMessage(this.connection, messageId);
  }
}
