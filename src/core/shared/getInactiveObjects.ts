/**
 * Get Inactive Objects - retrieve list of objects not yet activated
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { XMLParser } from "fast-xml-parser";
import { ObjectReference, InactiveObjectsResponse } from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
});

/**
 * Get list of inactive objects (objects that are not yet activated)
 * 
 * Endpoint: GET /sap/bc/adt/activation/inactiveobjects
 * 
 * @param connection - ABAP connection instance
 * @param options - Optional parameters
 * @returns List of inactive objects with their metadata
 * 
 * @example
 * ```typescript
 * const result = await getInactiveObjects(connection);
 * console.log(`Found ${result.objects.length} inactive objects`);
 * 
 * // Objects can be directly passed to activateObjectsGroup
 * await activateObjectsGroup(connection, result.objects);
 * ```
 */
export async function getInactiveObjects(
  connection: IAbapConnection,
  options?: {
    includeRawXml?: boolean;
  }
): Promise<InactiveObjectsResponse> {

  const response = await connection.makeAdtRequest({
    method: "GET",
    url: `/sap/bc/adt/activation/inactiveobjects`,
    timeout: getTimeout('default'),
    headers: {
      Accept: "application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8",
    },
  });

  const xml = response.data;
  const parsed = xmlParser.parse(xml);

  const objects: ObjectReference[] = [];

  // Parse XML response
  const root = parsed["ioc:inactiveObjects"];
  if (!root) {
    return { objects, xmlStr: options?.includeRawXml ? xml : undefined };
  }

  const entries = Array.isArray(root["ioc:entry"]) 
    ? root["ioc:entry"] 
    : root["ioc:entry"] 
      ? [root["ioc:entry"]] 
      : [];

  for (const entry of entries) {
    const objectData = entry["ioc:object"];
    if (!objectData) continue;

    const ref = objectData["ioc:ref"];
    if (!ref) continue;

    objects.push({
      type: ref["@_adtcore:type"] || "",
      name: ref["@_adtcore:name"] || "",
    });
  }

  return {
    objects,
    xmlStr: options?.includeRawXml ? xml : undefined,
  };
}
