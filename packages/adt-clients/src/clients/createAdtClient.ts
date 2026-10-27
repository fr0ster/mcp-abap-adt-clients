/**
 * Factory function for the ADT client.
 *
 * It detects nothing: the system type is the consumer's to declare. A system
 * of SAP_BASIS 7.50 or later gets `AdtClient`, which this returns; a 7.40
 * system is served by `AdtClientLegacy` from
 * `@mcp-abap-adt/adt-clients-legacy`, which the consumer constructs itself.
 * Kept async, as before, so existing callers need no change.
 */

import type { IAdtClientOptions } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtClient } from './AdtClient';

export async function createAdtClient(
  connection: IAbapConnection,
  logger?: ILogger,
  options?: IAdtClientOptions,
): Promise<AdtClient> {
  return new AdtClient(connection, logger, options);
}
