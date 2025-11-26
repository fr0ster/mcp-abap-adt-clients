/**
 * Package update operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName, limitDescription } from '../../utils/internalUtils';
import { CreatePackageParams } from './types';

/**
 * Build XML for package update (similar to create)
 * Note: masterSystem and responsible should only be included for cloud systems
 */
async function buildUpdatePackageXml(connection: AbapConnection, args: CreatePackageParams): Promise<string> {
  const { getSystemInformation } = await import('../../utils/systemInfo');
  
  // Get system information - only for cloud systems
  const systemInfo = await getSystemInformation(connection);
  const username = systemInfo?.userName || '';
  const systemId = systemInfo?.systemID || '';

  // Only add masterSystem and responsible for cloud systems
  const masterSystem = systemInfo ? systemId : '';
  const responsible = systemInfo ? (args.responsible || username) : '';

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = responsible ? ` adtcore:responsible="${responsible}"` : '';

  const softwareComponentName = args.software_component || 'HOME';
  const transportLayerXml = args.transport_layer
    ? `<pak:transportLayer pak:name="${args.transport_layer}"/>`
    : '<pak:transportLayer/>';

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(args.description || args.package_name);
  return `<?xml version="1.0" encoding="UTF-8"?><pak:package xmlns:pak="http://www.sap.com/adt/packages" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.package_name}" adtcore:type="DEVC/K" adtcore:version="active" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>

  <adtcore:packageRef adtcore:name="${args.package_name}"/>

  <pak:attributes pak:isEncapsulated="false" pak:packageType="${args.package_type || 'development'}" pak:recordChanges="false"/>

  <pak:superPackage adtcore:name="${args.super_package}"/>

  <pak:applicationComponent/>

  <pak:transport>

    <pak:softwareComponent pak:name="${softwareComponentName}"/>

    ${transportLayerXml}

  </pak:transport>

  <pak:translation/>

  <pak:useAccesses/>

  <pak:packageInterfaces/>

  <pak:subPackages/>

</pak:package>`;
}

export interface UpdatePackageParams extends CreatePackageParams {
  package_name: string;
}

/**
 * Update package with new data
 * 
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updatePackage(
  connection: AbapConnection,
  params: UpdatePackageParams,
  lockHandle: string
): Promise<AxiosResponse> {
  if (!params.package_name) {
    throw new Error('package_name is required');
  }

  const packageNameEncoded = encodeSapObjectName(params.package_name);
  const url = `/sap/bc/adt/packages/${packageNameEncoded}?lockHandle=${lockHandle}`;

  const xmlBody = await buildUpdatePackageXml(connection, params);

  const headers = {
    'Content-Type': 'application/vnd.sap.adt.packages.v2+xml',
    'Accept': 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml'
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers
  });
}

/**
 * Update only package description (safe update - only modifiable field)
 * Reads current package data and updates only description attribute
 * 
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updatePackageDescription(
  connection: AbapConnection,
  packageName: string,
  description: string,
  lockHandle: string
): Promise<AxiosResponse> {
  if (!packageName) {
    throw new Error('package_name is required');
  }
  if (!description) {
    throw new Error('description is required');
  }

  // Read current package to get existing XML
  const { getPackage } = await import('./read');
  const readResponse = await getPackage(connection, packageName);
  
  // Get current XML as string
  const currentXml = typeof readResponse.data === 'string' 
    ? readResponse.data 
    : JSON.stringify(readResponse.data);
  
  // Description is limited to 60 characters in SAP ADT
  const limitedDescription = limitDescription(description);
  // Replace description attribute in XML (simple string replacement)
  // Pattern: adtcore:description="old_value" -> adtcore:description="new_value"
  const descriptionRegex = /(adtcore:description=")([^"]*)(")/;
  const updatedXml = currentXml.replace(descriptionRegex, `$1${limitedDescription.replace(/"/g, '&quot;')}$3`);

  const packageNameEncoded = encodeSapObjectName(packageName);
  const url = `/sap/bc/adt/packages/${packageNameEncoded}?lockHandle=${lockHandle}`;

  const headers = {
    'Content-Type': 'application/vnd.sap.adt.packages.v2+xml',
    'Accept': 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml'
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: updatedXml,
    headers
  });
}

