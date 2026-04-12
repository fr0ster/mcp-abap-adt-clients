/**
 * Package validation operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { buildQueryString } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreatePackageParams } from './types';

/**
 * Step 1: Validate package parameters (basic check)
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export async function validatePackageBasic(
  connection: IAbapConnection,
  args: ICreatePackageParams,
): Promise<AxiosResponse> {
  const qs = buildQueryString({
    objname: args.package_name,
    packagename: args.super_package,
    description: args.description || args.package_name,
    packagetype: args.package_type || 'development',
    checkmode: 'basic',
  });
  const url = `/sap/bc/adt/packages/validation?${qs}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_VALIDATION,
    },
  });
}

/**
 * Step 3: Full validation with transport layer
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export async function validatePackageFull(
  connection: IAbapConnection,
  args: ICreatePackageParams,
  swcomp: string,
  transportLayer: string,
): Promise<AxiosResponse> {
  const qs = buildQueryString({
    objname: args.package_name,
    packagename: args.super_package,
    description: args.description || args.package_name,
    packagetype: args.package_type || 'development',
    swcomp: swcomp,
    transportlayer: transportLayer,
    recordChanges: 'false',
    checkmode: 'full',
  });
  const url = `/sap/bc/adt/packages/validation?${qs}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_VALIDATION,
    },
  });
}
