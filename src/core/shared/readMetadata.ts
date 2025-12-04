/**
 * Shared utilities for reading object metadata
 * Metadata endpoints return XML with object information (name, description, package, etc.)
 * without source code
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
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
 * Get Accept header for object type
 */
function getAcceptHeader(objectType: string): string {
  const type = objectType.toLowerCase();
  
  switch (type) {
    case 'class':
    case 'clas/oc':
      return 'application/vnd.sap.adt.oo.classes.v4+xml, application/vnd.sap.adt.oo.classes.v3+xml, application/vnd.sap.adt.oo.classes.v2+xml, application/vnd.sap.adt.oo.classes.v1+xml';
    case 'interface':
    case 'intf/if':
      return 'application/vnd.sap.adt.oo.interfaces.v2+xml, application/vnd.sap.adt.oo.interfaces.v1+xml';
    case 'table':
    case 'tabl/dt':
      return 'application/vnd.sap.adt.tables.v2+xml, application/vnd.sap.adt.tables.v1+xml, application/vnd.sap.adt.blues.v1+xml';
    case 'domain':
    case 'doma/dd':
      return 'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml';
    case 'dataelement':
    case 'dtel':
      return 'application/vnd.sap.adt.dataelements.v2+xml, application/vnd.sap.adt.dataelements.v1+xml';
    case 'structure':
    case 'stru/dt':
      return 'application/vnd.sap.adt.structures.v2+xml, application/vnd.sap.adt.structures.v1+xml';
    case 'view':
    case 'ddls/df':
      return 'application/vnd.sap.adt.ddlSource.v2+xml, application/vnd.sap.adt.ddlSource.v1+xml';
    case 'program':
    case 'prog/p':
      return 'application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs.v1+xml';
    case 'functiongroup':
    case 'fugr':
      return 'application/vnd.sap.adt.functions.groups.v2+xml, application/vnd.sap.adt.functions.groups.v1+xml';
    case 'functionmodule':
    case 'fugr/ff':
      return 'application/vnd.sap.adt.functions.fmodules.v2+xml, application/vnd.sap.adt.functions.fmodules.v1+xml';
    case 'package':
    case 'devc/k':
      return 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml';
    default:
      // Fallback to generic XML for unknown types
      return 'application/xml';
  }
}

/**
 * Read object metadata (without source code)
 */
export async function readObjectMetadata(
  connection: IAbapConnection,
  objectType: string,
  objectName: string,
  functionGroup?: string
): Promise<AxiosResponse> {
  const uri = getObjectMetadataUri(objectType, objectName, functionGroup);
  const acceptHeader = getAcceptHeader(objectType);

  return connection.makeAdtRequest({
    url: uri,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': acceptHeader
    }
  });
}

