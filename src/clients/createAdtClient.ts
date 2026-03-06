/**
 * Factory function that auto-detects SAP system version
 * and returns the appropriate ADT client.
 *
 * - Modern systems (BASIS >= 7.50): AdtClient with full CRUD
 * - Legacy systems (BASIS < 7.50): AdtClientLegacy with limited CRUD
 *
 * The client type depends on the system version (which ADT endpoints exist),
 * NOT on the connection type (HTTP vs RFC). Connection type is orthogonal:
 * - HTTP works for modern systems and read-only on legacy
 * - RFC works for both (and is the only way to get CRUD on legacy)
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { isModernAdtSystem } from '../utils/systemInfo';
import { AdtClient, type IAdtClientOptions } from './AdtClient';
import { AdtClientLegacy } from './AdtClientLegacy';

export async function createAdtClient(
  connection: IAbapConnection,
  logger?: ILogger,
  options?: IAdtClientOptions,
): Promise<AdtClient> {
  const isModern = await isModernAdtSystem(connection);
  return isModern
    ? new AdtClient(connection, logger, options)
    : new AdtClientLegacy(connection, logger, options);
}
