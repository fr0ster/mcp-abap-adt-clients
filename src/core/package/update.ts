/**
 * Package update operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName, limitDescription } from '../../utils/internalUtils';
import { CreatePackageParams } from './types';

/**
 * Build XML for package update (similar to create)
 * Note: masterSystem and responsible should only be included for cloud systems
 */
async function buildUpdatePackageXml(connection: IAbapConnection, args: CreatePackageParams): Promise<string> {
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
  connection: IAbapConnection,
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
 * Generates minimal XML with updated description without reading current package
 * 
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updatePackageDescription(
  connection: IAbapConnection,
  packageName: string,
  description: string,
  lockHandle: string,
  superPackage?: string
): Promise<AxiosResponse> {
  if (!packageName) {
    throw new Error('package_name is required');
  }
  if (!description) {
    throw new Error('description is required');
  }

  // Description is limited to 60 characters in SAP ADT
  const limitedDescription = limitDescription(description);
  
  // Generate minimal package XML with just description update
  // We don't need to GET the full package - SAP will merge this with existing data
  const params: UpdatePackageParams = {
    package_name: packageName,
    super_package: superPackage || '',
    description: limitedDescription,
    package_type: 'development' // Default, SAP will use existing if not changing
  };
  
  // Use the full updatePackage which doesn't do GET
  return updatePackage(connection, params, lockHandle);
}

