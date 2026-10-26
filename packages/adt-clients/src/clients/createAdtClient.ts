/**
 * Factory function that auto-detects SAP system version
 * and returns the appropriate ADT client.
 *
 * - Modern systems (BASIS >= 7.50): AdtClient with full CRUD
 * - Legacy systems (BASIS < 7.50): AdtClientLegacy, which answers a refusal for
 *   what 7.40 does not serve
 *
 * The client type depends on the system version (which ADT endpoints exist),
 * NOT on the connection type. The legacy client is supported, and was
 * measured (SAP_BASIS 7.40 SP04), over RFC only: HTTP to a legacy system is
 * unsupported, and nothing here detects the wire.
 */

import type { IAdtClientOptions } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { isModernAdtSystem } from '../utils/systemInfo';
import { AdtClient } from './AdtClient';
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
