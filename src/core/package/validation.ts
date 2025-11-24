/**
 * Package validation operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CreatePackageParams } from './types';

/**
 * Step 1: Validate package parameters (basic check)
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export async function validatePackageBasic(
  connection: AbapConnection,
  args: CreatePackageParams
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/packages/validation`;
  const params = {
    objname: args.package_name,
    packagename: args.super_package,
    description: args.description || args.package_name,
    packagetype: args.package_type || 'development',
    checkmode: 'basic'
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    params,
    headers: {
      'Accept': 'application/vnd.sap.as+xml'
    }
  });
}

/**
 * Step 3: Full validation with transport layer
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export async function validatePackageFull(
  connection: AbapConnection,
  args: CreatePackageParams,
  swcomp: string,
  transportLayer: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/packages/validation`;
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

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    params,
    headers: {
      'Accept': 'application/vnd.sap.as+xml'
    }
  });
}

