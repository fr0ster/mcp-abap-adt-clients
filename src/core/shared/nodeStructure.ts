/**
 * Node structure operations for ABAP objects
 *
 * Provides functions for fetching node structure from ADT repository.
 * Used by GetObjectInfo, GetIncludesList, and other tree navigation operations.
 */

import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
  IRepositoryNodeContents,
  IRepositoryObjectNode,
  XmlNode,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { getTimeout } from '../../utils/timeouts';

/**
 * Fetch node structure from ADT repository
 *
 * Endpoint: POST /sap/bc/adt/repository/nodestructure
 *
 * @param connection - ABAP connection instance
 * @param parentType - Parent object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
 * @param parentName - Parent object name
 * @param nodeId - Optional node ID (default: '0000' for root)
 * @param withShortDescriptions - Include short descriptions (default: true)
 * @returns Axios response with XML containing node structure
 *
 * @example
 * ```typescript
 * const response = await fetchNodeStructure(connection, 'CLAS/OC', 'ZMY_CLASS', '0000');
 * // Response contains XML with node structure
 * ```
 */
export async function fetchNodeStructure(
  connection: IAbapConnection,
  parentType: string,
  parentName: string,
  nodeId?: string,
  withShortDescriptions: boolean = true,
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/repository/nodestructure`;

  const params: Record<string, string | number | boolean> = {
    parent_type: parentType,
    parent_name: parentName,
    parent_tech_name: parentName,
    withShortDescriptions: withShortDescriptions,
  };

  if (nodeId) {
    params.node_id = nodeId;
  }

  const nodeKey = nodeId || '000000';
  const xmlBody =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">` +
    `<asx:values><DATA><TV_NODEKEY>${nodeKey}</TV_NODEKEY></DATA></asx:values>` +
    `</asx:abap>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    params,
    data: xmlBody,
    headers: {
      Accept:
        'application/vnd.sap.as+xml;dataname=com.sap.adt.RepositoryObjectTreeContent, application/vnd.sap.adt.repository.nodestructure.v1+xml, application/xml',
      'Content-Type':
        'application/vnd.sap.as+xml; charset=UTF-8; dataname=null',
    },
  });
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: true,
  trimValues: true,
});

/** One `SEU_ADT_OBJECT_TYPE_INFO` entry: a type and the node id holding it. */
export interface IObjectTypeInfo {
  objectType: string;
  nodeId: string;
}

/** The document's two halves, still as parsed XML. */
export interface IParsedNodeStructure {
  nodes: XmlNode[];
  objectTypes: IObjectTypeInfo[];
}

const readNodeValue = (value: XmlNode[string]): string | undefined => {
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

const asArray = (raw: unknown): XmlNode[] =>
  raw ? (Array.isArray(raw) ? (raw as XmlNode[]) : [raw as XmlNode]) : [];

/**
 * The node-structure document, parsed.
 *
 * Lives here, beside the request that produces it, because it had been copied
 * into `packageContentsList` and `packageHierarchy` — identical but for a logger
 * on the catch — and a third copy was the alternative to this one.
 *
 * A malformed or empty document answers empty rather than throwing: the callers
 * walk a tree and a level that cannot be read is a level with nothing under it,
 * not a failed traversal.
 */
export const parseNodeStructure = (
  xmlData: string,
  logger?: ILogger,
): IParsedNodeStructure => {
  const emptyResult: IParsedNodeStructure = { nodes: [], objectTypes: [] };
  try {
    if (!xmlData) {
      return emptyResult;
    }
    const result = xmlParser.parse(xmlData) as XmlNode;
    const abap = result?.['asx:abap'] as XmlNode | undefined;
    const data = (abap?.['asx:values'] as XmlNode | undefined)?.DATA as
      | XmlNode
      | undefined;

    const treeContent = data?.TREE_CONTENT as XmlNode | undefined;
    const nodes = asArray(treeContent?.SEU_ADT_REPOSITORY_OBJ_NODE);

    const objectTypesData = data?.OBJECT_TYPES as XmlNode | undefined;
    const typeInfos = asArray(objectTypesData?.SEU_ADT_OBJECT_TYPE_INFO);

    const objectTypes: IObjectTypeInfo[] = [];
    for (const typeInfo of typeInfos) {
      const objectType = readNodeValue(typeInfo?.OBJECT_TYPE);
      const nodeId = readNodeValue(typeInfo?.NODE_ID);
      if (objectType && nodeId) {
        objectTypes.push({ objectType, nodeId });
      }
    }

    return { nodes, objectTypes };
  } catch (error) {
    logger?.debug?.('Failed to parse node structure XML', { error });
    return emptyResult;
  }
};

/**
 * One level of the tree as `IAdtRepositoryStructure` promises it: the objects
 * here, and the node ids to ask for next.
 *
 * A node missing any of the four identity fields is dropped. `IRepositoryObjectNode`
 * names all four as required because a node without them cannot be identified or
 * fetched, which is what the traversal this was lifted from already assumed —
 * dropping it is stating that assumption rather than handing the caller a hole.
 */
export const toNodeContents = (
  xmlData: string,
  logger?: ILogger,
): IRepositoryNodeContents => {
  const { nodes, objectTypes } = parseNodeStructure(xmlData, logger);

  const objects: IRepositoryObjectNode[] = [];
  for (const node of nodes) {
    const objectType = readNodeValue(node?.OBJECT_TYPE);
    const objectName = readNodeValue(node?.OBJECT_NAME);
    const techName = readNodeValue(node?.TECH_NAME);
    const objectUri = readNodeValue(node?.OBJECT_URI);
    if (objectType && objectName && techName && objectUri) {
      objects.push({ objectType, objectName, techName, objectUri });
    }
  }

  return { objects, childNodeIds: objectTypes.map((t) => t.nodeId) };
};
