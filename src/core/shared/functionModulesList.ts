/**
 * List the function modules of a function group via ADT node structure.
 *
 * Thin wrapper over listFunctionGroupChildren for the FUGR/FF child type.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { listFunctionGroupChildren } from './functionGroupNodes';

export async function listFunctionModules(
  connection: IAbapConnection,
  functionGroupName: string,
): Promise<string[]> {
  return listFunctionGroupChildren(connection, functionGroupName, 'FUGR/FF');
}
