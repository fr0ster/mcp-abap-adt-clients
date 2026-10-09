/**
 * The function-group walk, as a consumer writes it.
 *
 * Until 19.0.0 this was `AdtUtils.listFunctionModules` and
 * `listFunctionGroupIncludes`, and `getIncludesList` beside them. Each read the
 * group's node structure, found the child type's node id, and read that node —
 * two requests, so no `IResultStrategy` could be given for one, and the shape
 * was fixed at `string[]` for everyone.
 *
 * It lives under `scripts/`, outside the published package, because it belongs
 * to whoever wants a list. Built over `fetchNodeStructure`, which is one
 * request and keeps its reading.
 */

import { readNodeStructure } from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { fetchNodeStructure } from '../../src/core/shared/nodeStructure';

const bodyOf = (data: unknown): string =>
  typeof data === 'string' ? data : JSON.stringify(data ?? '');

/**
 * The names of a function group's children of one type.
 *
 * Deduped on the uppercased name, first occurrence winning, because the node
 * structure can list the same object twice under different parents.
 */
export async function functionGroupChildren(
  connection: IAbapConnection,
  functionGroupName: string,
  childType: 'FUGR/FF' | 'FUGR/I',
  logger?: ILogger,
): Promise<string[]> {
  const name = functionGroupName.toUpperCase();

  const root = await fetchNodeStructure(
    connection,
    'FUGR/F',
    name,
    '000000',
    true,
  );
  const { objectTypes } = readNodeStructure(bodyOf(root.data));

  const wanted = objectTypes.find((t) => t.objectType === childType);
  if (!wanted) return [];

  const children = await fetchNodeStructure(
    connection,
    'FUGR/F',
    name,
    wanted.nodeId,
    true,
  );
  const { nodes } = readNodeStructure(bodyOf(children.data));

  const seen = new Set<string>();
  const names: string[] = [];
  for (const node of nodes) {
    const childName = String(node.OBJECT_NAME ?? '');
    if (!childName) continue;
    const key = childName.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(childName);
  }
  return names;
}
