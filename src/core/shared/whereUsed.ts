/**
 * Where-used operations for ABAP objects
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { IGetWhereUsedParams } from './types';

/**
 * Build object URI based on type and name
 */
function buildObjectUri(objectName: string, objectType: string): string {
  const encodedName = encodeSapObjectName(objectName);

  switch (objectType.toLowerCase()) {
    case 'class':
    case 'clas/oc':
      return `/sap/bc/adt/oo/classes/${encodedName}`;
    case 'program':
    case 'prog/p':
      return `/sap/bc/adt/programs/programs/${encodedName}`;
    case 'include':
      return `/sap/bc/adt/programs/includes/${encodedName}`;
    case 'function':
    case 'functiongroup':
    case 'fugr':
      return `/sap/bc/adt/functions/groups/${encodedName}`;
    case 'functionmodule':
    case 'function_module':
    case 'fugr/ff':
      if (objectName.includes('|')) {
        const [group, fm] = objectName.split('|');
        return `/sap/bc/adt/functions/groups/${encodeSapObjectName(group)}/fmodules/${encodeSapObjectName(fm)}`;
      }
      throw new Error('Function module name must be in format GROUP|FM_NAME');
    case 'interface':
    case 'intf/if':
      return `/sap/bc/adt/oo/interfaces/${encodedName}`;
    case 'package':
    case 'devc/k':
      return `/sap/bc/adt/packages/${encodedName}`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
    case 'domain':
    case 'doma/dd':
      return `/sap/bc/adt/ddic/domains/${encodedName}`;
    case 'dataelement':
    case 'dtel':
      return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
    default:
      throw new Error(`Unsupported object type for where-used: ${objectType}`);
  }
}

/**
 * Get where-used references for ABAP object
 *
 * @param connection - ABAP connection
 * @param params - Where-used parameters
 * @returns Where-used references
 */
export async function getWhereUsed(
  connection: IAbapConnection,
  params: IGetWhereUsedParams
): Promise<AxiosResponse> {
  if (!params.object_name) {
    throw new Error('Object name is required');
  }
  if (!params.object_type) {
    throw new Error('Object type is required');
  }

  const objectUri = buildObjectUri(params.object_name, params.object_type);
  const url = `/sap/bc/adt/repository/informationsystem/usageReferences?uri=${encodeURIComponent(objectUri)}`;

  const requestBody = '<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageReferenceRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences"><usagereferences:affectedObjects/></usagereferences:usageReferenceRequest>';

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: requestBody,
    headers: {
      'Content-Type': 'application/vnd.sap.adt.repository.usagereferences.request.v1+xml',
      'Accept': 'application/vnd.sap.adt.repository.usagereferences.result.v1+xml'
    }
  });
}

