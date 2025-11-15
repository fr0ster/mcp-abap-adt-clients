/**
 * Package update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { CreatePackageParams } from './types';

/**
 * Build XML for package update (similar to create)
 */
function buildUpdatePackageXml(args: CreatePackageParams): string {
  const username = args.responsible || process.env.SAP_USERNAME || process.env.SAP_USER || 'DEVELOPER';
  const softwareComponentName = args.software_component || 'HOME';
  const transportLayerXml = args.transport_layer
    ? `<pak:transportLayer pak:name="${args.transport_layer}"/>`
    : '<pak:transportLayer/>';

  return `<?xml version="1.0" encoding="UTF-8"?><pak:package xmlns:pak="http://www.sap.com/adt/packages" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${args.description || args.package_name}" adtcore:language="EN" adtcore:name="${args.package_name}" adtcore:type="DEVC/K" adtcore:version="active" adtcore:masterLanguage="EN" adtcore:masterSystem="${process.env.SAP_SYSTEM || 'E19'}" adtcore:responsible="${username}">

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
 */
export async function updatePackage(
  connection: AbapConnection,
  params: UpdatePackageParams,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  if (!params.package_name) {
    throw new Error('package_name is required');
  }

  const packageNameEncoded = encodeSapObjectName(params.package_name);
  const url = `/sap/bc/adt/packages/${packageNameEncoded}?lockHandle=${lockHandle}`;

  const xmlBody = buildUpdatePackageXml(params);

  const headers = {
    'Content-Type': 'application/vnd.sap.adt.packages.v2+xml',
    'Accept': 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml'
  };

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, xmlBody, headers);
}

