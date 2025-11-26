/**
 * ServiceDefinition read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP service definition
 */
export async function getServiceDefinition(
  connection: AbapConnection,
  serviceDefinitionName: string,
  version: 'active' | 'inactive' | 'workingArea' = 'inactive'
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(serviceDefinitionName.toLowerCase());
  const url = `/sap/bc/adt/ddic/srvd/sources/${encodedName}${version ? `?version=${version}` : ''}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.ddic.srvd.v1+xml'
    }
  });
}

/**
 * Get service definition source code
 */
export async function getServiceDefinitionSource(
  connection: AbapConnection,
  serviceDefinitionName: string,
  version: 'active' | 'inactive' | 'workingArea' = 'inactive'
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(serviceDefinitionName.toLowerCase());
  const url = `/sap/bc/adt/ddic/srvd/sources/${encodedName}/source/main${version ? `?version=${version}` : ''}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'text/plain'
    }
  });
}

