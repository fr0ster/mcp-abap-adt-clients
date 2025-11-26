/**
 * Behavior Implementation read operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get behavior implementation class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 */
export async function getBehaviorImplementationMetadata(
  connection: AbapConnection,
  className: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'class', className);
}

/**
 * Get behavior implementation class source code (main)
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getBehaviorImplementationSource(
  connection: AbapConnection,
  className: string,
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'class', className, undefined, version);
}

/**
 * Get behavior implementation class implementations include source code
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getBehaviorImplementationImplementations(
  connection: AbapConnection,
  className: string,
  version: 'active' | 'inactive' | 'workingArea' = 'active'
): Promise<AxiosResponse> {
  const { encodeSapObjectName } = await import('../../utils/internalUtils');
  const { getTimeout } = await import('@mcp-abap-adt/connection');
  
  const encodedName = encodeSapObjectName(className).toLowerCase();
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations${version !== 'active' ? `?version=${version}` : ''}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'text/plain'
    }
  });
}

