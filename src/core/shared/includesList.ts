/**
 * Include list operations for ABAP objects
 *
 * Recursively discovers and lists all include files within an ABAP program or include.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { fetchNodeStructure } from './nodeStructure';

/**
 * Get list of includes for ABAP object
 *
 * Uses node structure endpoint to recursively discover includes.
 *
 * @param connection - ABAP connection instance
 * @param objectName - Object name (program or include)
 * @param objectType - Object type: 'PROG/P' | 'PROG/I' | 'FUGR' | 'CLAS/OC'
 * @param timeout - Optional timeout in milliseconds (default: 30000)
 * @returns Array of include names
 *
 * @example
 * ```typescript
 * const includes = await getIncludesList(connection, 'ZMY_PROGRAM', 'PROG/P');
 * // Returns: ['ZMY_INCLUDE1', 'ZMY_INCLUDE2', ...]
 * ```
 */
export async function getIncludesList(
  connection: IAbapConnection,
  objectName: string,
  objectType: 'PROG/P' | 'PROG/I' | 'FUGR' | 'CLAS/OC',
  timeout: number = 30000,
): Promise<string[]> {
  if (!objectName) {
    throw new Error('Object name is required');
  }

  const parentName = objectName.toUpperCase();
  const _parentTechName = parentName;
  const parentType = objectType;

  try {
    // Step 1: Get root node structure to find includes node
    const rootResponse = await Promise.race([
      fetchNodeStructure(connection, parentType, parentName, '000000', true),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Timeout after ${timeout}ms while fetching root node structure for ${objectName}`,
              ),
            ),
          timeout,
        ),
      ),
    ]);

    // Step 2: Parse response to find includes node ID
    const includesInfo = parseIncludesFromXml(rootResponse.data);
    const includesNode = includesInfo.find((info) => info.name === 'PROG/I');

    if (!includesNode) {
      return [];
    }

    // Step 3: Get includes list using the found node ID
    const includesResponse = await Promise.race([
      fetchNodeStructure(
        connection,
        parentType,
        parentName,
        includesNode.node_id,
        true,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Timeout after ${timeout}ms while fetching includes list for ${objectName}`,
              ),
            ),
          timeout,
        ),
      ),
    ]);

    // Step 4: Parse the includes response to extract include names
    const includeNames = parseIncludeNamesFromXml(includesResponse.data);

    return includeNames;
  } catch (error) {
    throw new Error(
      `Failed to get includes list for ${objectType} '${objectName}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Parse XML to extract includes information (node structure)
 */
function parseIncludesFromXml(
  xmlData: string,
): Array<{ name: string; node_id: string; label: string }> {
  const includes: Array<{ name: string; node_id: string; label: string }> = [];

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      trimValues: true,
    });
    const result = parser.parse(xmlData);

    // Navigate through XML structure
    const data = result?.['asx:abap']?.['asx:values']?.DATA;
    const treeContent = data?.TREE_CONTENT;
    const objectTypeInfo = treeContent?.SEU_ADT_OBJECT_TYPE_INFO;

    if (!objectTypeInfo) {
      return includes;
    }

    const typeInfoArray = Array.isArray(objectTypeInfo)
      ? objectTypeInfo
      : [objectTypeInfo];

    for (const info of typeInfoArray) {
      const objectType = info?.OBJECT_TYPE;
      if (objectType === 'PROG/I') {
        const nodeId = info?.NODE_ID;
        const label = info?.OBJECT_TYPE_LABEL || '';

        if (nodeId) {
          includes.push({
            name: 'PROG/I',
            node_id: String(nodeId),
            label: String(label),
          });
        }
      }
    }
  } catch (_error) {
    // Return empty array on parse error
  }

  return includes;
}

/**
 * Parse XML to extract actual include names from node structure
 */
function parseIncludeNamesFromXml(xmlData: string): string[] {
  const includeNames: string[] = [];

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      trimValues: true,
    });
    const result = parser.parse(xmlData);

    // Navigate through XML structure
    const data = result?.['asx:abap']?.['asx:values']?.DATA;
    const treeContent = data?.TREE_CONTENT;
    const nodes = treeContent?.SEU_ADT_REPOSITORY_OBJ_NODE;

    if (!nodes) {
      return includeNames;
    }

    const nodeArray = Array.isArray(nodes) ? nodes : [nodes];

    for (const node of nodeArray) {
      const objectType = node?.OBJECT_TYPE;
      if (objectType === 'PROG/I') {
        const objectName = node?.OBJECT_NAME;
        if (objectName && typeof objectName === 'string') {
          const decodedName = decodeURIComponent(objectName.trim());
          if (decodedName) {
            includeNames.push(decodedName);
          }
        }
      }
    }
  } catch (_error) {
    // Return empty array on parse error
  }

  return [...new Set(includeNames)]; // Remove duplicates
}
