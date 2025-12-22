/**
 * Shared utilities for reading object source code
 * Source endpoints return source code text (plain text or XML)
 * Only available for objects that have source code
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get object source URI based on object type
 */
export function getObjectSourceUri(
  objectType: string,
  objectName: string,
  functionGroup?: string,
  version: 'active' | 'inactive' = 'active',
): string {
  const encodedName = encodeSapObjectName(objectName);
  const versionParam = version === 'inactive' ? '?version=inactive' : '';

  switch (objectType.toLowerCase()) {
    case 'class':
    case 'clas/oc':
      return `/sap/bc/adt/oo/classes/${encodedName}/source/main${versionParam}`;
    case 'program':
    case 'prog/p':
      return `/sap/bc/adt/programs/programs/${encodedName}/source/main`;
    case 'interface':
    case 'intf/if':
      return `/sap/bc/adt/oo/interfaces/${encodedName}/source/main${versionParam}`;
    case 'functionmodule':
    case 'fugr/ff': {
      if (!functionGroup) {
        throw new Error('Function group is required for function module');
      }
      const encodedGroup = encodeSapObjectName(functionGroup);
      return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/source/main${versionParam}`;
    }
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}/source/main`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}/source/main`;
    case 'tabletype':
    case 'ttyp/df':
      return `/sap/bc/adt/ddic/tabletypes/${encodedName}/source/main`;
    default:
      throw new Error(
        `Object type ${objectType} does not support source code reading`,
      );
  }
}

/**
 * Check if object type supports source code reading
 */
export function supportsSourceCode(objectType: string): boolean {
  const supportedTypes = [
    'class',
    'clas/oc',
    'program',
    'prog/p',
    'interface',
    'intf/if',
    'functionmodule',
    'fugr/ff',
    'view',
    'ddls/df',
    'structure',
    'stru/dt',
    'table',
    'tabl/dt',
    'tabletype',
    'ttyp/df',
  ];
  return supportedTypes.includes(objectType.toLowerCase());
}

/**
 * Read object source code
 * Only works for objects that have source code (class, program, interface, etc.)
 * @param connection - ABAP connection
 * @param objectType - Object type (e.g., 'class', 'program')
 * @param objectName - Object name
 * @param functionGroup - Optional function group for function modules
 * @param version - 'active' or 'inactive'
 * @param options - Optional read options
 * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
 */
export async function readObjectSource(
  connection: IAbapConnection,
  objectType: string,
  objectName: string,
  functionGroup?: string,
  version: 'active' | 'inactive' = 'active',
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  if (!supportsSourceCode(objectType)) {
    throw new Error(
      `Object type ${objectType} does not support source code reading`,
    );
  }

  let uri = getObjectSourceUri(objectType, objectName, functionGroup, version);
  if (options?.withLongPolling) {
    const separator = uri.includes('?') ? '&' : '?';
    uri += `${separator}withLongPolling=true`;
  }

  return connection.makeAdtRequest({
    url: uri,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'text/plain',
    },
  });
}
