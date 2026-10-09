/**
 * Factory function that auto-detects SAP system version and returns the
 * appropriate executor client — the twin of `createAdtClient`.
 *
 * - Modern systems (BASIS >= 7.50): AdtExecutor
 * - Legacy systems (BASIS < 7.50): AdtExecutorLegacy
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { isModernAdtSystem } from '../utils/systemInfo';
import { AdtExecutor } from './AdtExecutor';
import { AdtExecutorLegacy } from './AdtExecutorLegacy';

export async function createAdtExecutor(
  connection: IAbapConnection,
  logger?: ILogger,
): Promise<AdtExecutor> {
  const isModern = await isModernAdtSystem(connection);
  return isModern
    ? new AdtExecutor(connection, logger)
    : new AdtExecutorLegacy(connection, logger);
}
