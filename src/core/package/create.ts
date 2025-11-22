/**
 * Package create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { validatePackageBasic, validatePackageFull } from './validation';
import { checkTransportRequirements } from './transportCheck';
import { checkPackage } from './check';
import { CreatePackageParams } from './types';
import { getSystemInformation } from '../shared/systemInfo';

/**
 * Step 4: Create package
 * Only allowed parameters: name, description, superPackage, packageType, softwareComponent, transportLayer
 * masterSystem/responsible are derived via getSystemInformation (cloud) or env fallbacks
 */
async function createPackageInternal(
  connection: AbapConnection,
  args: CreatePackageParams,
  swcomp: string,
  transportLayer: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/packages`;

  // Escape XML special characters in description
  const escapeXml = (str: string | undefined): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const description = escapeXml(args.description || args.package_name);
  const packageType = args.package_type || 'development';

  // Get master system / responsible from ADT metadata helper (cloud) with env fallback
  const systemInfo = await getSystemInformation(connection);
  const masterSystem = systemInfo?.systemID;
  const responsibleUser =
    args.responsible ||
    systemInfo?.userName ||
    process.env.SAP_USERNAME ||
    process.env.SAP_USER ||
    '';
  
  // All attributes must be present in XML body, even if empty
  // Software component - always include, with name attribute if provided
  const softwareComponentXml = swcomp
    ? `<pak:softwareComponent pak:name="${escapeXml(swcomp)}"/>`
    : '<pak:softwareComponent/>';
  
  // Transport layer - always include, with name attribute if provided
  const transportLayerXml = transportLayer
    ? `<pak:transportLayer pak:name="${escapeXml(transportLayer)}"/>`
    : '<pak:transportLayer/>';

  // Build XML with all required attributes
  const responsibleAttr = responsibleUser ? ` adtcore:responsible="${escapeXml(responsibleUser)}"` : '';
  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${escapeXml(masterSystem)}"` : '';
  // Application component - always include, with name attribute if provided
  const applicationComponentXml = args.application_component
    ? `<pak:applicationComponent pak:name="${escapeXml(args.application_component)}"/>`
    : '<pak:applicationComponent/>';
  
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><pak:package xmlns:pak="http://www.sap.com/adt/packages" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.package_name}" adtcore:type="DEVC/K" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>

  <adtcore:packageRef adtcore:name="${args.package_name}"/>

  <pak:attributes pak:isEncapsulated="false" pak:packageType="${packageType}" pak:recordChanges="false"/>

  <pak:superPackage adtcore:name="${args.super_package}"/>

  ${applicationComponentXml}

  <pak:transport>

    ${softwareComponentXml}

    ${transportLayerXml}

  </pak:transport>

  <pak:translation/>

  <pak:useAccesses/>

  <pak:packageInterfaces/>

  <pak:subPackages/>

</pak:package>`;

  const queryParams = transportRequest ? { corrNr: transportRequest } : undefined;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    params: queryParams,
    headers: {
      'Accept': 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
      'Content-Type': 'application/vnd.sap.adt.packages.v2+xml'
    }
  });

  return response;
}

/**
 * Create ABAP package
 * Full workflow: validate basic -> check transport -> validate full -> create -> check
 */
export async function createPackage(
  connection: AbapConnection,
  params: CreatePackageParams
): Promise<AxiosResponse> {
  if (!params.package_name) {
    throw new Error('Package name is required');
  }
  if (!params.super_package) {
    throw new Error('Super package (parent package) is required');
  }

  // software_component and transport_layer can be empty/undefined
  const swcomp = params.software_component;
  const transportLayer = params.transport_layer;

  try {
    await validatePackageBasic(connection, params);

    let transportRequest = params.transport_request;
    if (transportLayer && !transportRequest) {
      const availableTransports = await checkTransportRequirements(connection, params, transportLayer);

      if (availableTransports.length > 0) {
        transportRequest = availableTransports[0];
      }
    }

    if (transportLayer && !transportRequest) {
      throw new Error('Transport request is required when transport_layer is specified. Please provide transport_request parameter or create a transport first.');
    }

    // Full validation only if both swcomp and transportLayer are provided
    // Otherwise SAP will complain about missing transport layer
    if (swcomp && transportLayer) {
      await validatePackageFull(connection, params, swcomp, transportLayer);
    }

    // In XML body, all attributes must be present (even if empty)
    // Pass empty strings to createPackageInternal so XML includes all elements
    const createResponse = await createPackageInternal(
      connection, 
      params, 
      swcomp || '', 
      transportLayer || '', 
      transportRequest
    );

    await checkPackage(connection, params.package_name);

    // Return the real response from SAP (from initial POST)
    return createResponse;

  } catch (error: any) {
    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create package ${params.package_name}: ${errorMessage}`);
  }
}

