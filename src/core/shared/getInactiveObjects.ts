import { AbapConnection, getTimeout } from "@mcp-abap-adt/connection";
import { XMLParser } from "fast-xml-parser";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
});

/**
 * Inactive object entry from ADT API
 */
export interface InactiveObject {
  user: string;
  deleted: boolean;
  ref: {
    uri: string;
    type: string;
    name: string;
  };
  transport?: string;
}

/**
 * Response from getInactiveObjects
 */
export interface InactiveObjectsResponse {
  objects: InactiveObject[];
  rawXml?: string;
}

/**
 * Get list of inactive objects (objects that are not yet activated)
 * 
 * @param connection - ABAP connection instance
 * @param options - Optional parameters
 * @returns List of inactive objects with their metadata
 * 
 * @example
 * ```typescript
 * const result = await getInactiveObjects(connection);
 * console.log(`Found ${result.objects.length} inactive objects`);
 * result.objects.forEach(obj => {
 *   console.log(`${obj.ref.name} (${obj.ref.type}) - user: ${obj.user}`);
 * });
 * ```
 */
export async function getInactiveObjects(
  connection: AbapConnection,
  options?: {
    includeRawXml?: boolean;
  }
): Promise<InactiveObjectsResponse> {
  const baseUrl = await connection.getBaseUrl();

  const response = await connection.makeAdtRequest({
    method: "GET",
    url: `${baseUrl}/sap/bc/adt/activation/inactiveobjects`,
    timeout: getTimeout('default'),
    headers: {
      Accept: "application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8",
    },
  });

  const xml = response.data;
  const parsed = xmlParser.parse(xml);

  const objects: InactiveObject[] = [];

  // Parse XML response
  const root = parsed["ioc:inactiveObjects"];
  if (!root) {
    return { objects, rawXml: options?.includeRawXml ? xml : undefined };
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
      user: objectData["@_ioc:user"] || "",
      deleted: objectData["@_ioc:deleted"] === "true",
      ref: {
        uri: ref["@_adtcore:uri"] || "",
        type: ref["@_adtcore:type"] || "",
        name: ref["@_adtcore:name"] || "",
      },
      transport: entry["ioc:transport"]?.["@_adtcore:name"] || undefined,
    });
  }

  return {
    objects,
    rawXml: options?.includeRawXml ? xml : undefined,
  };
}
