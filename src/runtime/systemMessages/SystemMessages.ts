/**
 * SystemMessages - Domain object for SM02 system messages
 *
 * Provides list and detail access to system messages.
 */

import type {
  IAbapConnection,
  IAdtResponse,
  IFeedQueryOptions,
  ILogger,
  ISystemMessages,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import { getSystemMessage, listSystemMessages } from './read';

/** The messages this system is showing. Both members answer their document. */
export class SystemMessages implements ISystemMessages<string, string> {
  readonly kind = 'systemMessages' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IFeedQueryOptions): Promise<IAdtResponse<string>> {
    return answering(
      () => listSystemMessages(this.connection, options),
      rawDocument,
    );
  }

  async getById(messageId: string): Promise<IAdtResponse<string>> {
    return answering(
      () => getSystemMessage(this.connection, messageId),
      rawDocument,
    );
  }
}
