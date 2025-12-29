/**
 * Package contents list operations
 *
 * Provides a flat list view of package contents using node structure traversal.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { fetchNodeStructure } from './nodeStructure';
import type {
  IGetPackageContentsListOptions,
  IPackageContentItem,
  PackageHierarchySupportedType,
} from './types';

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

const isPackageType = (adtType: string): boolean =>
  adtType === 'DEVC' || adtType.startsWith('DEVC/');

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
  return undefined;
};

interface IObjectTypeInfo {
  objectType: string;
  nodeId: string;
}

interface IParsedNodeStructure {
  nodes: any[];
  objectTypes: IObjectTypeInfo[];
}

const parseNodeStructure = (xmlData: string): IParsedNodeStructure => {
  const emptyResult: IParsedNodeStructure = { nodes: [], objectTypes: [] };
  try {
    if (!xmlData) {
      return emptyResult;
    }
    const result = xmlParser.parse(xmlData) as Record<string, unknown>;
    const data = (result as any)?.['asx:abap']?.['asx:values']?.DATA;

    // Parse TREE_CONTENT nodes
    const treeContent = data?.TREE_CONTENT;
    const rawNodes = treeContent?.SEU_ADT_REPOSITORY_OBJ_NODE;
    const nodes = rawNodes
      ? Array.isArray(rawNodes)
        ? rawNodes
        : [rawNodes]
      : [];

    // Parse OBJECT_TYPES to get NODE_ID for each object type
    const objectTypesData = data?.OBJECT_TYPES;
    const rawTypes = objectTypesData?.SEU_ADT_OBJECT_TYPE_INFO;
    const typeInfos = rawTypes
      ? Array.isArray(rawTypes)
        ? rawTypes
        : [rawTypes]
      : [];

    const objectTypes: IObjectTypeInfo[] = [];
    for (const typeInfo of typeInfos) {
      const objectType = readNodeValue(typeInfo?.OBJECT_TYPE);
      const nodeId = readNodeValue(typeInfo?.NODE_ID);
      if (objectType && nodeId) {
        objectTypes.push({ objectType, nodeId });
      }
    }

    return { nodes, objectTypes };
  } catch {
    return emptyResult;
  }
};

const parseNodesToItems = (
  nodes: any[],
  packageName: string,
  includeDescriptions: boolean,
): IPackageContentItem[] => {
  const items: IPackageContentItem[] = [];

  for (const node of nodes) {
    const objectName = readNodeValue(node?.OBJECT_NAME);
    const objectType = readNodeValue(node?.OBJECT_TYPE)?.toUpperCase();
    const description = readNodeValue(node?.DESCRIPTION);

    if (!objectName || !objectType) {
      continue;
    }

    items.push({
      name: String(objectName).trim(),
      adtType: objectType,
      type: mapAdtTypeToSupported(objectType),
      description:
        includeDescriptions && description
          ? String(description).trim()
          : undefined,
      packageName,
      isPackage: isPackageType(objectType),
    });
  }

  return items;
};

async function fetchPackageContentsFlat(
  connection: IAbapConnection,
  packageName: string,
  includeDescriptions: boolean,
  _logger?: ILogger,
): Promise<IPackageContentItem[]> {
  // Initial request - returns subpackages and OBJECT_TYPES with NODE_IDs
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
  const { nodes, objectTypes } = parseNodeStructure(xml);

  // Collect all items from initial response (subpackages)
  const allItems: IPackageContentItem[] = parseNodesToItems(
    nodes,
    packageName,
    includeDescriptions,
  );

  // Fetch objects for each non-package type using their NODE_ID
  for (const typeInfo of objectTypes) {
    // Skip DEVC/K as subpackages are already in initial response
    if (isPackageType(typeInfo.objectType)) {
      continue;
    }

    try {
      const typeResponse = await fetchNodeStructure(
        connection,
        'DEVC/K',
        packageName,
        typeInfo.nodeId,
        includeDescriptions,
      );
      const typeXml =
        typeof typeResponse.data === 'string'
          ? typeResponse.data
          : JSON.stringify(typeResponse.data);
      const { nodes: typeNodes } = parseNodeStructure(typeXml);
      const typeItems = parseNodesToItems(
        typeNodes,
        packageName,
        includeDescriptions,
      );
      allItems.push(...typeItems);
    } catch {
      // Skip failed type fetches
    }
  }

  return allItems;
}

/**
 * Get package contents as a flat list
 *
 * Fetches all objects in a package and returns them as a flat array.
 * Optionally includes contents of subpackages recursively.
 *
 * @param connection - ABAP connection instance
 * @param packageName - Package name
 * @param options - Optional options for fetching
 * @param logger - Optional logger
 * @returns Array of package content items
 */
export async function getPackageContentsList(
  connection: IAbapConnection,
  packageName: string,
  options?: IGetPackageContentsListOptions,
  logger?: ILogger,
): Promise<IPackageContentItem[]> {
  const includeSubpackages = options?.includeSubpackages === true;
  const maxDepth = options?.maxDepth ?? 5;
  const includeDescriptions = options?.includeDescriptions !== false;
  const packageNameUpper = packageName.toUpperCase();

  const items = await fetchPackageContentsFlat(
    connection,
    packageNameUpper,
    includeDescriptions,
    logger,
  );

  if (!includeSubpackages) {
    return items;
  }

  // Recursively fetch subpackage contents
  const subpackages = items.filter((item) => item.isPackage);
  const visited = new Set<string>([packageNameUpper]);

  const fetchSubpackageContents = async (
    subpackageName: string,
    currentDepth: number,
  ): Promise<IPackageContentItem[]> => {
    if (currentDepth >= maxDepth || visited.has(subpackageName)) {
      return [];
    }
    visited.add(subpackageName);

    const subItems = await fetchPackageContentsFlat(
      connection,
      subpackageName,
      includeDescriptions,
      logger,
    );

    const nestedSubpackages = subItems.filter(
      (item) => item.isPackage && !visited.has(item.name),
    );
    const nestedItems: IPackageContentItem[] = [];

    for (const nested of nestedSubpackages) {
      const nestedContents = await fetchSubpackageContents(
        nested.name,
        currentDepth + 1,
      );
      nestedItems.push(...nestedContents);
    }

    return [...subItems, ...nestedItems];
  };

  for (const subpackage of subpackages) {
    const subContents = await fetchSubpackageContents(subpackage.name, 1);
    items.push(...subContents);
  }

  return items;
}
