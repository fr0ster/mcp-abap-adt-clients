/**
 * Package hierarchy operations
 *
 * Builds a tree of package contents using virtual folders.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import type { IPackageHierarchyNode } from './types';
import { getVirtualFoldersContents } from './virtualFolders';

type NodeValue = Record<string, unknown> | unknown[] | string | number | null;
type NodeRecord = Record<string, NodeValue>;

interface IVirtualFolderEntry {
  name?: string;
  displayName?: string;
  facet?: string;
  text?: string;
  type?: string;
}

interface IVirtualObjectEntry {
  name?: string;
  type?: string;
  text?: string;
  packageName?: string;
}

interface IInternalHierarchyNode extends IPackageHierarchyNode {
  packageName?: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

const debugEnabled =
  process.env.DEBUG_ADT_TESTS === 'true' ||
  process.env.DEBUG_ADT_TEST === 'true' ||
  process.env.DEBUG_TESTS === 'true';

const readAttr = (node: NodeRecord, name: string): string | undefined => {
  const value = node[`@_${name}`];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const findVirtualFoldersResult = (value: NodeValue): NodeRecord | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findVirtualFoldersResult(entry as NodeValue);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  const record = value as NodeRecord;
  for (const [key, entry] of Object.entries(record)) {
    if (
      key === 'virtualFoldersResult' ||
      key.endsWith(':virtualFoldersResult')
    ) {
      return entry as NodeRecord;
    }
    const found = findVirtualFoldersResult(entry);
    if (found) {
      return found;
    }
  }
  return undefined;
};

const parseVirtualFoldersXml = (
  xml: string,
): { folders: IVirtualFolderEntry[]; objects: IVirtualObjectEntry[] } => {
  const parsed = xmlParser.parse(xml) as NodeRecord;
  const root = findVirtualFoldersResult(parsed);
  if (!root) {
    throw new Error('Failed to parse virtual folders result');
  }
  const folderNodes = asArray(
    (root['vfs:virtualFolder'] as NodeRecord | NodeRecord[] | undefined) ||
      (root.virtualFolder as NodeRecord | NodeRecord[] | undefined),
  );
  const objectNodes = asArray(
    (root['vfs:object'] as NodeRecord | NodeRecord[] | undefined) ||
      (root.object as NodeRecord | NodeRecord[] | undefined),
  );

  return {
    folders: folderNodes.map((node) => ({
      name: readAttr(node, 'name'),
      displayName: readAttr(node, 'displayName'),
      facet: readAttr(node, 'facet'),
      text: readAttr(node, 'text'),
      type: readAttr(node, 'type'),
    })),
    objects: objectNodes.map((node) => ({
      name: readAttr(node, 'name'),
      type: readAttr(node, 'type'),
      text: readAttr(node, 'text'),
      packageName:
        readAttr(node, 'packageName') ||
        readAttr(node, 'package') ||
        readAttr(node, 'devclass') ||
        undefined,
    })),
  };
};

const collectObjectNodes = (
  node: IInternalHierarchyNode,
  out: IInternalHierarchyNode[],
): void => {
  if (node.adtType) {
    out.push(node);
  }
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      collectObjectNodes(child as IInternalHierarchyNode, out);
    }
  }
};

const groupTreeByPackage = (
  root: IInternalHierarchyNode,
): IPackageHierarchyNode => {
  if (!root.children || root.children.length === 0) {
    return root;
  }

  const rootName = root.name.toUpperCase();
  const objectNodes: IInternalHierarchyNode[] = [];
  for (const child of root.children) {
    collectObjectNodes(child as IInternalHierarchyNode, objectNodes);
  }

  const packageNodes = new Map<string, IPackageHierarchyNode>();
  const rootObjects: IPackageHierarchyNode[] = [];

  for (const node of objectNodes) {
    const packageName = node.packageName?.toUpperCase();
    if (packageName && packageName !== rootName) {
      let packageNode = packageNodes.get(packageName);
      if (!packageNode) {
        packageNode = {
          name: packageName,
          adtType: 'DEVC/K',
          children: [],
        };
        packageNodes.set(packageName, packageNode);
      }
      packageNode.children = [...(packageNode.children || []), node];
      continue;
    }
    rootObjects.push(node);
  }

  return {
    ...root,
    children: [...packageNodes.values(), ...rootObjects],
  };
};

export async function getPackageHierarchy(
  connection: IAbapConnection,
  packageName: string,
): Promise<IPackageHierarchyNode> {
  const packageNameUpper = packageName.toUpperCase();

  const baseSelection = [{ facet: 'PACKAGE', values: [packageNameUpper] }];
  const groupResponse = await getVirtualFoldersContents(connection, {
    objectSearchPattern: '*',
    preselection: baseSelection,
    facetOrder: ['GROUP'],
  });
  const groupXml =
    typeof groupResponse.data === 'string'
      ? groupResponse.data
      : JSON.stringify(groupResponse.data);
  if (debugEnabled) {
    console.log('[AdtUtils.getPackageHierarchy] GROUP XML:', groupXml);
  }
  const groupResult = parseVirtualFoldersXml(groupXml);
  const groups = groupResult.folders.filter(
    (entry) => entry.facet?.toUpperCase() === 'GROUP',
  );

  const rootTree: IInternalHierarchyNode = {
    name: packageNameUpper,
    adtType: 'DEVC/K',
    children: [],
  };

  for (const group of groups) {
    const groupSelection = group.name || group.displayName || 'GROUP';
    const groupLabel = group.displayName || group.name || 'GROUP';
    const groupNode: IInternalHierarchyNode = {
      name: groupLabel,
      description: groupLabel !== groupSelection ? groupSelection : undefined,
      children: [],
    };

    const typeResponse = await getVirtualFoldersContents(connection, {
      objectSearchPattern: '*',
      preselection: [
        ...baseSelection,
        { facet: 'GROUP', values: [groupSelection] },
      ],
      facetOrder: ['TYPE'],
    });
    const typeXml =
      typeof typeResponse.data === 'string'
        ? typeResponse.data
        : JSON.stringify(typeResponse.data);
    if (debugEnabled) {
      console.log(
        `[AdtUtils.getPackageHierarchy] TYPE XML (group=${groupSelection}):`,
        typeXml,
      );
    }
    const typeResult = parseVirtualFoldersXml(typeXml);
    const types = typeResult.folders.filter(
      (entry) => entry.facet?.toUpperCase() === 'TYPE',
    );

    for (const type of types) {
      const typeSelection = type.name || type.displayName || 'TYPE';
      const typeLabel = type.displayName || type.name || 'TYPE';
      const typeNode: IInternalHierarchyNode = {
        name: typeLabel,
        description: typeLabel !== typeSelection ? typeSelection : undefined,
        children: [],
      };

      const objectResponse = await getVirtualFoldersContents(connection, {
        objectSearchPattern: '*',
        preselection: [
          ...baseSelection,
          { facet: 'GROUP', values: [groupSelection] },
          { facet: 'TYPE', values: [typeSelection] },
        ],
        facetOrder: [],
      });
      const objectXml =
        typeof objectResponse.data === 'string'
          ? objectResponse.data
          : JSON.stringify(objectResponse.data);
      if (debugEnabled) {
        console.log(
          `[AdtUtils.getPackageHierarchy] OBJECT XML (group=${groupSelection}, type=${typeSelection}):`,
          objectXml,
        );
      }
      const objectResult = parseVirtualFoldersXml(objectXml);

      typeNode.children = objectResult.objects
        .filter((entry) => entry.name)
        .map((entry) => ({
          name: entry.name || '',
          adtType: entry.type,
          description: entry.text,
          packageName: entry.packageName,
          children: [],
        }));

      groupNode.children?.push(typeNode);
    }

    rootTree.children?.push(groupNode);
  }

  return groupTreeByPackage(rootTree);
}
