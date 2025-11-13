/**
 * Package validation operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { XMLParser } from 'fast-xml-parser';
import { CreatePackageParams } from './types';

/**
 * Step 1: Validate package parameters (basic check)
 */
export async function validatePackageBasic(
  connection: AbapConnection,
  args: CreatePackageParams
): Promise<void> {
  const baseUrl = await connection.getBaseUrl();
  const url = `${baseUrl}/sap/bc/adt/packages/validation`;
  const params = {
    objname: args.package_name,
    packagename: args.super_package,
    description: args.description || args.package_name,
    packagetype: args.package_type || 'development',
    checkmode: 'basic'
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    params,
    headers: {
      'Accept': 'application/vnd.sap.as+xml'
    }
  });

  const parser = new XMLParser({ ignoreAttributes: false });
  const result = parser.parse(response.data);
  const severity = result['asx:abap']?.['asx:values']?.DATA?.SEVERITY;

  if (severity !== 'OK') {
    const shortText = result['asx:abap']?.['asx:values']?.DATA?.SHORT_TEXT || 'Validation failed';
    throw new Error(`Package validation failed: ${shortText}`);
  }
}

/**
 * Step 3: Full validation with transport layer
 */
export async function validatePackageFull(
  connection: AbapConnection,
  args: CreatePackageParams,
  swcomp: string,
  transportLayer: string
): Promise<void> {
  const baseUrl = await connection.getBaseUrl();
  const url = `${baseUrl}/sap/bc/adt/packages/validation`;
  const params = {
    objname: args.package_name,
    packagename: args.super_package,
    description: args.description || args.package_name,
    packagetype: args.package_type || 'development',
    swcomp: swcomp,
    transportlayer: transportLayer,
    recordChanges: 'false',
    checkmode: 'full'
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    params,
    headers: {
      'Accept': 'application/vnd.sap.as+xml'
    }
  });

  const parser = new XMLParser({ ignoreAttributes: false });
  const result = parser.parse(response.data);
  const severity = result['asx:abap']?.['asx:values']?.DATA?.SEVERITY;

  if (severity !== 'OK') {
    const shortText = result['asx:abap']?.['asx:values']?.DATA?.SHORT_TEXT || 'Full validation failed';
    throw new Error(`Package full validation failed: ${shortText}`);
  }
}

