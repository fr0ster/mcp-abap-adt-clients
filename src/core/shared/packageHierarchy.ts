/**
 * Package hierarchy operations
 *
 * Builds a tree of package contents and subpackages from node structure.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { getPackageContents } from '../package/read';
import type { IPackageHierarchyNode } from './types';

type NodeValue = Record<string, unknown> | unknown[] | string | number | null;
type NodeRecord = Record<string, NodeValue>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

const isNodeRecord = (value: NodeValue): value is NodeRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const getAttribute = (node: NodeRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = node[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
};

const getNodeName = (node: NodeRecord): string | undefined =>
  getAttribute(node, ['@_adtcore:name', '@_name', 'adtcore:name', 'name']);

const getNodeType = (node: NodeRecord): string | undefined =>
  getAttribute(node, ['@_adtcore:type', '@_type', 'adtcore:type', 'type']);

const getNodeDescription = (node: NodeRecord): string | undefined =>
  getAttribute(node, [
    '@_adtcore:description',
    '@_description',
    'adtcore:description',
    'description',
  ]);

const collectNodeObjects = (value: NodeValue): NodeRecord[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectNodeObjects(entry as NodeValue));
  }
  const record = value as NodeRecord;
  const results: NodeRecord[] = [];
  if (isNodeRecord(record) && record['adtcore:node']) {
    results.push(record);
  }
  for (const entry of Object.values(record)) {
    results.push(...collectNodeObjects(entry));
  }
  return results;
};

const collectChildNodes = (node: NodeRecord): NodeRecord[] => {
  const nodes: NodeRecord[] = [];
  const children = node['adtcore:node'] as NodeValue | undefined;
  if (children) {
    nodes.push(...collectNodeObjects(children));
  }
  return nodes;
};

const findNodeByName = (
  value: NodeValue,
  name: string,
): NodeRecord | undefined => {
  const candidates = collectNodeObjects(value);
  return candidates.find(
    (node) => getNodeName(node)?.toUpperCase() === name.toUpperCase(),
  );
};

const parseNodeTree = (node: NodeRecord): IPackageHierarchyNode => {
  const name = getNodeName(node) || 'UNKNOWN';
  const adtType = getNodeType(node);
  const description = getNodeDescription(node);
  const treeNode: IPackageHierarchyNode = {
    name,
    adtType,
    description,
  };
  const children = collectChildNodes(node);
  if (children.length > 0) {
    treeNode.children = children.map(parseNodeTree);
  }
  return treeNode;
};

export async function getPackageHierarchy(
  connection: IAbapConnection,
  packageName: string,
): Promise<IPackageHierarchyNode> {
  const packageNameUpper = packageName.toUpperCase();
  const response = await getPackageContents(connection, packageNameUpper);
  const xml =
    typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data);
  const parsed = xmlParser.parse(xml);
  const rootNodeObject =
    findNodeByName(parsed, packageNameUpper) || collectNodeObjects(parsed)[0];

  if (!rootNodeObject) {
    throw new Error(
      `Failed to parse package hierarchy for ${packageNameUpper}`,
    );
  }

  return parseNodeTree(rootNodeObject);
}
