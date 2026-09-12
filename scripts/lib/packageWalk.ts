/**
 * The package walk, as a consumer writes it.
 *
 * Until 19.0.0 this lived in the package as `getPackageHierarchy` and
 * `getPackageContentsList`. It cannot: a walk is one node-structure request per
 * object type plus a descent into subpackages, and `IResultStrategy` takes one
 * answer — so a member that walks has already chosen the shape for its caller,
 * and the package shipped one member per shape.
 *
 * It lives under `scripts/` — outside the published package, which ships only
 * `dist`, `docs/usage`, the README and the licences — because it belongs to
 * whoever wants a tree. The dev scripts and the integration tests use it the
 * way any consumer would, over the two single-request members that stayed:
 * `fetchNodeStructure` and the `parseNodeStructure` reading.
 */
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import {
  fetchNodeStructure,
  parseNodeStructure,
} from '../../src/core/shared/nodeStructure';

export interface IWalkedNode {
  readonly name: string;
  readonly type: string;
  readonly isPackage: boolean;
  readonly children: IWalkedNode[];
}

const isPackageType = (type: string): boolean =>
  type === 'DEVC/K' || type.startsWith('DEVC');

const bodyOf = (data: unknown): string =>
  typeof data === 'string' ? data : JSON.stringify(data ?? '');

/**
 * One level: the package's own node structure, plus one request per object
 * type it reports.
 *
 * **An empty body is a level with nothing in it, and nothing more than that.**
 * This walk used to read zero bytes as "the package does not exist" and raise.
 *
 * Measured 2026-09-12, four packages through this same function:
 *
 * | package | `/packages/{name}` | node structure |
 * |---|---|---|
 * | a populated root | `200` | 3551 bytes, 3 subpackages, 4 object types |
 * | a shared fixture | `200` | 4204 bytes, 15 object types |
 * | an empty leftover | `200` | **0 bytes** |
 * | a container left empty | `200` | **0 bytes** |
 * | a name never created | `404` | not asked |
 *
 * So zero bytes is what an **existing but empty** package answers, and the
 * sentence this used to raise was wrong about the one case it named. This
 * endpoint cannot separate empty from absent, so the walk states neither and
 * descends no further. A caller who needs the distinction has `/packages/
 * {name}`, which answers `404` for a name that was never created.
 */
export async function walkPackage(
  connection: IAbapConnection,
  packageName: string,
  depth = 2,
  logger?: ILogger,
): Promise<IWalkedNode> {
  const name = packageName.toUpperCase();

  const root = await fetchNodeStructure(
    connection,
    'DEVC/K',
    name,
    undefined,
    true,
  );
  const xml = bodyOf(root.data);
  if (xml.trim().length === 0) {
    logger?.debug?.('node structure came back empty', { package: name });
    return { name, type: 'DEVC/K', isPackage: true, children: [] };
  }

  const { nodes, objectTypes } = parseNodeStructure(xml, logger);
  const all = [...nodes];

  for (const typeInfo of objectTypes) {
    if (isPackageType(typeInfo.objectType)) continue;
    const perType = await fetchNodeStructure(
      connection,
      'DEVC/K',
      name,
      typeInfo.nodeId,
      true,
    );
    all.push(...parseNodeStructure(bodyOf(perType.data), logger).nodes);
  }

  const children: IWalkedNode[] = [];
  for (const node of all) {
    const type = String(node.OBJECT_TYPE ?? '');
    const childName = String(node.OBJECT_NAME ?? '');
    if (!childName) continue;
    const isPackage = isPackageType(type);
    children.push(
      isPackage && depth > 1
        ? await walkPackage(connection, childName, depth - 1, logger)
        : { name: childName, type, isPackage, children: [] },
    );
  }

  return { name, type: 'DEVC/K', isPackage: true, children };
}
