/**
 * Package create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { validatePackageBasic, validatePackageFull } from './validation';
import { checkTransportRequirements } from './transportCheck';
import { checkPackage } from './check';
import { CreatePackageParams } from './types';

/**
 * Step 4: Create package
 */
async function createPackageInternal(
  connection: AbapConnection,
  args: CreatePackageParams,
  swcomp: string,
  transportLayer: string,
  transportRequest?: string,
  isLocalPackage?: boolean
): Promise<any> {
  const baseUrl = await connection.getBaseUrl();
  const url = `${baseUrl}/sap/bc/adt/packages`;
  const username = args.responsible || process.env.SAP_USERNAME || process.env.SAP_USER || 'DEVELOPER';

  const softwareComponentName = isLocalPackage ? 'ZLOCAL' : swcomp;
  const transportLayerXml = isLocalPackage
    ? '<pak:transportLayer/>'
    : `<pak:transportLayer pak:name="${transportLayer}"/>`;

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><pak:package xmlns:pak="http://www.sap.com/adt/packages" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${args.description || args.package_name}" adtcore:language="EN" adtcore:name="${args.package_name}" adtcore:type="DEVC/K" adtcore:version="active" adtcore:masterLanguage="EN" adtcore:masterSystem="${process.env.SAP_SYSTEM || 'E19'}" adtcore:responsible="${username}">

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

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const result = parser.parse(response.data);

  return result['pak:package'];
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

  const hasTransportRequest = !!params.transport_request;
  const hasSoftwareComponent = !!params.software_component;
  const hasTransportLayer = !!params.transport_layer;

  const isLocalPackage = !hasTransportRequest && !hasSoftwareComponent && !hasTransportLayer;

  const swcomp = params.software_component || 'HOME';
  const transportLayer = params.transport_layer || process.env.SAP_TRANSPORT_LAYER || 'ZE19';

  try {
    await validatePackageBasic(connection, params);

    let transportRequest = params.transport_request;
    if (!isLocalPackage && transportLayer) {
      const availableTransports = await checkTransportRequirements(connection, params, transportLayer);

      if (!transportRequest && availableTransports.length > 0) {
        transportRequest = availableTransports[0];
      }
    }

    if (!transportRequest && !isLocalPackage) {
      throw new Error('Transport request is required for transportable packages. Please provide transport_request parameter or create a transport first.');
    }

    if (!isLocalPackage) {
      await validatePackageFull(connection, params, swcomp, transportLayer);
    }

    const packageData = await createPackageInternal(connection, params, swcomp, transportLayer, transportRequest, isLocalPackage);

    await checkPackage(connection, params.package_name);

    return {
      data: {
        success: true,
        package_name: params.package_name,
        description: params.description || params.package_name,
        super_package: params.super_package,
        package_type: params.package_type || 'development',
        software_component: swcomp,
        transport_layer: transportLayer,
        transport_request: transportRequest,
        uri: `/sap/bc/adt/packages/${params.package_name.toLowerCase()}`,
        message: `Package ${params.package_name} created successfully`
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create package ${params.package_name}: ${errorMessage}`);
  }
}

