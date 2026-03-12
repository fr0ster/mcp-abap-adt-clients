/**
 * Package update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields (abapLanguageVersion, etc.)
 * that would be lost if XML were built from scratch.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IUpdatePackageParams,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_PACKAGE, CT_PACKAGE } from '../../constants/contentTypes';
import {
  encodeSapObjectName,
  limitDescription,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import {
  extractXmlString,
  patchIf,
  patchXmlAttribute,
  patchXmlElementAttribute,
} from '../../utils/xmlPatch';

/**
 * Patch current package XML with updated values.
 * Only modifies fields that are explicitly provided in args.
 */
function patchPackageXml(
  currentXml: string,
  args: IUpdatePackageParams,
): string {
  let xml = currentXml;

  // Description (always provided for update)
  if (args.description) {
    const description = limitDescription(args.description);
    xml = patchXmlAttribute(xml, 'adtcore:description', description);
  }

  // Responsible
  xml = patchIf(xml, args.responsible, (x, val) =>
    patchXmlAttribute(x, 'adtcore:responsible', val),
  );

  // Master system
  xml = patchIf(xml, args.master_system, (x, val) =>
    patchXmlAttribute(x, 'adtcore:masterSystem', val),
  );

  // Package type (pak:packageType attribute on pak:attributes element)
  xml = patchIf(xml, args.package_type, (x, val) =>
    patchXmlElementAttribute(x, 'pak:attributes', 'pak:packageType', val),
  );

  // Record changes
  if (args.record_changes !== undefined) {
    xml = patchXmlElementAttribute(
      xml,
      'pak:attributes',
      'pak:recordChanges',
      args.record_changes ? 'true' : 'false',
    );
  }

  // Super package
  xml = patchIf(xml, args.super_package, (x, val) =>
    patchXmlElementAttribute(x, 'pak:superPackage', 'adtcore:name', val),
  );

  // Software component
  xml = patchIf(xml, args.software_component, (x, val) =>
    patchXmlElementAttribute(x, 'pak:softwareComponent', 'pak:name', val),
  );

  // Transport layer
  xml = patchIf(xml, args.transport_layer, (x, val) =>
    patchXmlElementAttribute(x, 'pak:transportLayer', 'pak:name', val),
  );

  return xml;
}

/**
 * Update package with new data (read-modify-write pattern)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updatePackage(
  connection: IAbapConnection,
  params: IUpdatePackageParams,
  lockHandle: string,
): Promise<AxiosResponse> {
  if (!params.package_name) {
    throw new Error('package_name is required');
  }

  const packageNameEncoded = encodeSapObjectName(params.package_name);

  // 1. GET current XML
  const currentResponse = await connection.makeAdtRequest({
    url: `/sap/bc/adt/packages/${packageNameEncoded}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_PACKAGE },
  });
  const currentXml = extractXmlString(currentResponse.data);

  // 2. Patch only changed fields
  const updatedXml = patchPackageXml(currentXml, params);

  // 3. PUT
  const corrNrParam = params.transport_request
    ? `&corrNr=${params.transport_request}`
    : '';
  const url = `/sap/bc/adt/packages/${packageNameEncoded}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;

  const headers = {
    'Content-Type': CT_PACKAGE,
    Accept: ACCEPT_PACKAGE,
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: updatedXml,
    headers,
  });
}

/**
 * Update only package description (safe update - only modifiable field)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updatePackageDescription(
  connection: IAbapConnection,
  packageName: string,
  description: string,
  lockHandle: string,
  superPackage?: string,
): Promise<AxiosResponse> {
  if (!packageName) {
    throw new Error('package_name is required');
  }
  if (!description) {
    throw new Error('description is required');
  }

  return updatePackage(
    connection,
    {
      package_name: packageName,
      description: limitDescription(description),
      super_package: superPackage || '',
      record_changes: false,
    },
    lockHandle,
  );
}
