/**
 * List the includes of a function group via ADT node structure.
 *
 * Thin wrapper over listFunctionGroupChildren for the FUGR/I child type.
 * Includes are the group's TOP include (global data/types), the UXX collector,
 * and any custom includes (FORM routines, helpers) — code that is NOT part of
 * any function module, so a complete FUGR backup needs them.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { listFunctionGroupChildren } from './functionGroupNodes';

export async function listFunctionGroupIncludes(
  connection: IAbapConnection,
  functionGroupName: string,
): Promise<string[]> {
  return listFunctionGroupChildren(connection, functionGroupName, 'FUGR/I');
}
