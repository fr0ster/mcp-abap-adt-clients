/**
 * Package hierarchy operations
 *
 * Builds a tree of package contents using node structure traversal.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { fetchNodeStructure } from './nodeStructure';
import type {
  IGetPackageHierarchyOptions,
  IPackageHierarchyNode,
  PackageHierarchyCodeFormat,
  PackageHierarchySupportedType,
} from './types';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: true,
  trimValues: true,
});

type NodeValue = Record<string, unknown> | unknown[] | string | number | null;

const readNodeValue = (value: NodeValue): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const textValue = record['#text'] ?? record._text;
    if (
      typeof textValue === 'string' ||
      typeof textValue === 'number' ||
      typeof textValue === 'boolean'
    ) {
      return String(textValue);
    }
  }
  return undefined;
};

const normalizeAdtType = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const type = String(value).trim().toUpperCase();
  return type.length > 0 ? type : undefined;
};

const isPackageType = (adtType: string): boolean =>
  adtType === 'DEVC' || adtType.startsWith('DEVC/');

const mapAdtTypeToCodeFormat = (
  adtType?: string,
): PackageHierarchyCodeFormat | undefined => {
  const type = normalizeAdtType(adtType);
  if (!type) {
    return undefined;
  }

  if (type === 'DEVC/K' || type === 'DEVC') return 'xml';
  if (type.startsWith('DEVC/')) return 'xml';
  if (type.startsWith('DOMA/')) return 'xml';
  if (type.startsWith('DTEL/')) return 'xml';
  if (type === 'FUGR/F' || type === 'FUGR') return 'xml';

  if (type.startsWith('CLAS/')) return 'source';
  if (type.startsWith('INTF/')) return 'source';
  if (type.startsWith('PROG/')) return 'source';
  if (type.startsWith('DDLS/')) return 'source';
  if (type.startsWith('DDLX/')) return 'source';
  if (type.startsWith('SRVD/')) return 'source';
  if (type.startsWith('TABL/DT')) return 'source';
  if (type.startsWith('TABL/DS') || type.startsWith('STRU/')) return 'source';
  if (type.startsWith('TTYP/')) return 'source';
  if (type.startsWith('FUGR/FF')) return 'source';
  if (type.startsWith('BDEF/')) return 'source';
  if (type.startsWith('BIMP/') || type.startsWith('BIMPL/')) return 'source';

  return undefined;
};

const mapAdtTypeToSupported = (
  adtType?: string,
): PackageHierarchySupportedType | undefined => {
  if (!adtType) {
    return undefined;
  }
  const type = adtType.toUpperCase();
  const map: Record<string, PackageHierarchySupportedType> = {
    'DEVC/K': 'package',
    'DOMA/DD': 'domain',
    'DTEL/DE': 'dataElement',
    'TABL/DS': 'structure',
    'STRU/DT': 'structure',
    'TABL/DT': 'table',
    'TTYP/DF': 'tableType',
    'TTYP/TT': 'tableType',
    'DDLS/DF': 'view',
    'DDLX/EX': 'metadataExtension',
    'CLAS/OC': 'class',
    'INTF/IF': 'interface',
    'INTF/OI': 'interface',
    'PROG/P': 'program',
    'FUGR/FF': 'functionModule',
    'FUGR/F': 'functionGroup',
    FUGR: 'functionGroup',
    'SRVD/SRV': 'serviceDefinition',
    'BDEF/BDO': 'behaviorDefinition',
    'BIMP/BIM': 'behaviorImplementation',
    'BIMP/BI': 'behaviorImplementation',
    'BIMP/BO': 'behaviorImplementation',
  };
  if (map[type]) {
    return map[type];
  }
  if (type.startsWith('CLAS/')) return 'class';
  if (type.startsWith('INTF/')) return 'interface';
  if (type.startsWith('PROG/')) return 'program';
  if (type.startsWith('DDLS/')) return 'view';
  if (type.startsWith('DDLX/')) return 'metadataExtension';
  if (type.startsWith('SRVD/')) return 'serviceDefinition';
  if (type.startsWith('DOMA/')) return 'domain';
  if (type.startsWith('DTEL/')) return 'dataElement';
  if (type.startsWith('TABL/DS') || type.startsWith('STRU/'))
    return 'structure';
  if (type.startsWith('TABL/DT')) return 'table';
  if (type.startsWith('TTYP/')) return 'tableType';
  if (type.startsWith('FUGR/FF')) return 'functionModule';
  if (type.startsWith('FUGR/')) return 'functionGroup';
  if (type.startsWith('DEVC/')) return 'package';
  if (type.startsWith('BDEF/')) return 'behaviorDefinition';
  if (type.startsWith('BIMP/')) return 'behaviorImplementation';
  if (type.startsWith('BIMPL/')) return 'behaviorImplementation';
  return undefined;
};

const isRestoreImplemented = (
  type?: PackageHierarchySupportedType,
): boolean => {
  if (!type) {
    return false;
  }
  const supported = new Set<PackageHierarchySupportedType>([
    'package',
    'domain',
    'dataElement',
    'structure',
    'table',
    'tableType',
    'view',
    'class',
    'interface',
    'program',
    'functionGroup',
    'functionModule',
    'serviceDefinition',
    'metadataExtension',
    'behaviorDefinition',
    'behaviorImplementation',
  ]);
  return supported.has(type);
};

const parseNodeStructure = (xmlData: string, logger?: ILogger): any[] => {
  try {
    if (!xmlData) {
      return [];
    }
    const result = xmlParser.parse(xmlData) as Record<string, unknown>;
    const data = (result as any)?.['asx:abap']?.['asx:values']?.DATA;
    const treeContent = data?.TREE_CONTENT;
    const nodes = treeContent?.SEU_ADT_REPOSITORY_OBJ_NODE;
    if (!nodes) {
      return [];
    }
    return Array.isArray(nodes) ? nodes : [nodes];
  } catch (error) {
    if (debugEnabled) {
      logger?.warn?.('Failed to parse node structure XML', error);
    }
    return [];
  }
};

const buildTreeFromNodes = (
  nodes: any[],
  includeDescriptions: boolean,
  logger?: ILogger,
): IPackageHierarchyNode[] => {
  const nodeMap = new Map<
    string,
    IPackageHierarchyNode & {
      _nodeId?: string;
      _parentNodeId?: string;
    }
  >();
  const orderedKeys: string[] = [];
  let hasHierarchy = false;

  for (const node of nodes) {
    const objectName = readNodeValue(node?.OBJECT_NAME);
    const objectTypeRaw = readNodeValue(node?.OBJECT_TYPE);
    const objectType = normalizeAdtType(objectTypeRaw);
    const nodeId = readNodeValue(node?.NODE_ID);
    const parentNodeId = readNodeValue(node?.PARENT_NODE_ID);
    const description = readNodeValue(node?.DESCRIPTION);

    if (!objectName || !objectType) {
      continue;
    }

    const isPackage = isPackageType(objectType);
    const key =
      nodeId || `${objectType}:${objectName}:${orderedKeys.length.toString()}`;

    const supportedType = mapAdtTypeToSupported(objectType);
    nodeMap.set(key, {
      name: String(objectName).trim(),
      adtType: objectType,
      type: supportedType,
      description: includeDescriptions
        ? description
          ? String(description).trim()
          : undefined
        : undefined,
      is_package: isPackage,
      codeFormat: mapAdtTypeToCodeFormat(objectType),
      restoreStatus: isRestoreImplemented(supportedType)
        ? 'ok'
        : 'not-implemented',
      children: [],
      _nodeId: nodeId,
      _parentNodeId: parentNodeId,
    });
    orderedKeys.push(key);

    if (nodeId && parentNodeId) {
      hasHierarchy = true;
    }
  }

  if (hasHierarchy) {
    const roots: IPackageHierarchyNode[] = [];
    for (const key of orderedKeys) {
      const entry = nodeMap.get(key);
      if (!entry) {
        continue;
      }
      const parentNodeId = entry._parentNodeId;
      if (parentNodeId && nodeMap.has(parentNodeId)) {
        nodeMap.get(parentNodeId)?.children?.push(entry);
      } else {
        roots.push(entry);
      }
    }
    for (const key of orderedKeys) {
      const entry = nodeMap.get(key);
      if (entry) {
        delete entry._nodeId;
        delete entry._parentNodeId;
      }
    }
    return roots;
  }

  const result: IPackageHierarchyNode[] = orderedKeys
    .map((key) => {
      const entry = nodeMap.get(key);
      if (!entry) {
        return null;
      }
      delete entry._nodeId;
      delete entry._parentNodeId;
      return entry;
    })
    .filter((entry): entry is IPackageHierarchyNode => entry !== null);

  if (debugEnabled) {
    logger?.debug?.(
      `Built flat list: ${result.length} nodes (packages: ${
        result.filter((node) => node.is_package).length
      })`,
    );
  }

  return result;
};

const createPackageNode = (
  packageName: string,
  children: IPackageHierarchyNode[],
): IPackageHierarchyNode => ({
  name: packageName,
  adtType: 'DEVC/K',
  type: 'package',
  is_package: true,
  codeFormat: mapAdtTypeToCodeFormat('DEVC/K'),
  restoreStatus: 'ok',
  children,
});

const fetchPackageTreeRecursive = async (
  connection: IAbapConnection,
  packageName: string,
  currentDepth: number,
  maxDepth: number,
  includeDescriptions: boolean,
  includeSubpackages: boolean,
  logger?: ILogger,
): Promise<IPackageHierarchyNode> => {
  if (currentDepth >= maxDepth) {
    return createPackageNode(packageName, []);
  }

  const response = await fetchNodeStructure(
    connection,
    'DEVC/K',
    packageName,
    undefined,
    includeDescriptions,
  );
  const xml =
    typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data);
  const nodes = parseNodeStructure(xml, logger);

  if (nodes.length === 0) {
    return createPackageNode(packageName, []);
  }

  const children = buildTreeFromNodes(nodes, includeDescriptions, logger);
  const packageNode = createPackageNode(packageName, children);

  if (currentDepth < maxDepth && children.length > 0) {
    const subpackages = children.filter((child) => child.is_package);
    if (subpackages.length > 0) {
      const subpackageMaxDepth = includeSubpackages
        ? maxDepth
        : currentDepth + 1;

      const subpackageTrees = await Promise.all(
        subpackages.map((subpackage) =>
          fetchPackageTreeRecursive(
            connection,
            subpackage.name,
            currentDepth + 1,
            subpackageMaxDepth,
            includeDescriptions,
            includeSubpackages,
            logger,
          ),
        ),
      );

      packageNode.children = packageNode.children?.map((child) => {
        if (!child.is_package) {
          return child;
        }
        const subpackageTree = subpackageTrees.find(
          (tree) => tree.name === child.name,
        );
        return subpackageTree
          ? { ...subpackageTree, children: subpackageTree.children || [] }
          : { ...child, children: child.children || [] };
      });
    }
  }

  return packageNode;
};

export async function getPackageHierarchy(
  connection: IAbapConnection,
  packageName: string,
  options?: IGetPackageHierarchyOptions,
  logger?: ILogger,
): Promise<IPackageHierarchyNode> {
  const includeSubpackages = options?.includeSubpackages !== false;
  const maxDepth = options?.maxDepth ?? 5;
  const includeDescriptions = options?.includeDescriptions !== false;
  const packageNameUpper = packageName.toUpperCase();

  if (debugEnabled) {
    logger?.debug?.(
      `Fetching package tree for ${packageNameUpper} (include_subpackages: ${includeSubpackages}, max_depth: ${maxDepth})`,
    );
  }

  const tree = await fetchPackageTreeRecursive(
    connection,
    packageNameUpper,
    0,
    maxDepth,
    includeDescriptions,
    includeSubpackages,
    logger,
  );

  tree.name = packageNameUpper;
  tree.adtType = 'DEVC/K';
  tree.type = 'package';
  tree.is_package = true;
  tree.codeFormat = mapAdtTypeToCodeFormat('DEVC/K');

  return tree;
}
