/**
 * Factory function for the executor client — the twin of `createAdtClient`.
 *
 * It detects nothing: the system type is the consumer's to declare. This
 * returns `AdtExecutor`; a 7.40 system is served by `AdtExecutorLegacy` from
 * `@mcp-abap-adt/adt-clients-legacy`, which the consumer constructs itself.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtExecutor } from './AdtExecutor';

export async function createAdtExecutor(
  connection: IAbapConnection,
  logger?: ILogger,
): Promise<AdtExecutor> {
  return new AdtExecutor(connection, logger);
}
