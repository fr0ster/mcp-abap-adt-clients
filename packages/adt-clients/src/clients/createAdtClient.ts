/**
 * Factory function for the ADT client of a declared variant.
 *
 * It detects nothing and sends nothing: the variant is the consumer's to
 * declare, and the client it answers is fixed to it — `AdtClientOnPrem` for
 * `'onprem'`, `AdtClientCloud` for `'cloud'`. A SAP_BASIS 7.40 system is
 * served by `AdtClientLegacy` from `@mcp-abap-adt/adt-clients-legacy`, which
 * the consumer constructs itself. Kept async, as before.
 */

import type { IAdtClientOptions } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtClientCloud, AdtClientOnPrem } from './AdtClientVariants';
import type { AdtModernVariant } from './variant';

/** What `createAdtClient` takes beside the connection. */
export interface ICreateAdtClientOptions<V extends AdtModernVariant>
  extends IAdtClientOptions {
  /** The release variant of the system, declared. */
  variant: V;
  logger?: ILogger;
}

export async function createAdtClient(
  connection: IAbapConnection,
  options: ICreateAdtClientOptions<'onprem'>,
): Promise<AdtClientOnPrem>;
export async function createAdtClient(
  connection: IAbapConnection,
  options: ICreateAdtClientOptions<'cloud'>,
): Promise<AdtClientCloud>;
/** A variant known only as one of the two: the client is one of the two. */
export async function createAdtClient(
  connection: IAbapConnection,
  options: ICreateAdtClientOptions<AdtModernVariant>,
): Promise<AdtClientOnPrem | AdtClientCloud>;
export async function createAdtClient(
  connection: IAbapConnection,
  options: ICreateAdtClientOptions<AdtModernVariant>,
): Promise<AdtClientOnPrem | AdtClientCloud> {
  const { variant, logger, ...clientOptions } = options;
  return variant === 'onprem'
    ? new AdtClientOnPrem(connection, logger, clientOptions)
    : new AdtClientCloud(connection, logger, clientOptions);
}
