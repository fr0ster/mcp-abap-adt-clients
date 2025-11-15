/**
 * Shared utilities for reading object metadata
 * Metadata endpoints return XML with object information (name, description, package, etc.)
 * without source code
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get object metadata URI based on object type
 */
export function getObjectMetadataUri(objectType: string, objectName: string, functionGroup?: string): string {
  const encodedName = encodeSapObjectName(objectName);

  switch (objectType.toLowerCase()) {
    case 'class':
    case 'clas/oc':
      return `/sap/bc/adt/oo/classes/${encodedName}`;
    case 'program':
    case 'prog/p':
      return `/sap/bc/adt/programs/programs/${encodedName}`;
    case 'interface':
    case 'intf/if':
      return `/sap/bc/adt/oo/interfaces/${encodedName}`;
    case 'functionmodule':
    case 'fugr/ff':
      if (!functionGroup) {
        throw new Error('Function group is required for function module');
      }
      const encodedGroup = encodeSapObjectName(functionGroup);
      return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}`;
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}`;
    case 'domain':
    case 'doma/dd':
      return `/sap/bc/adt/ddic/domains/${encodedName}`;
    case 'dataelement':
    case 'dtel':
      return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    case 'functiongroup':
    case 'fugr':
      return `/sap/bc/adt/functions/groups/${encodedName}`;
    case 'package':
    case 'devc/k':
      return `/sap/bc/adt/packages/${encodedName}`;
    default:
      throw new Error(`Unsupported object type for metadata: ${objectType}`);
  }
}

/**
 * Read object metadata (without source code)
 */
export async function readObjectMetadata(
  connection: AbapConnection,
  objectType: string,
  objectName: string,
  functionGroup?: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const uri = getObjectMetadataUri(objectType, objectName, functionGroup);
  const url = `${baseUrl}${uri}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

