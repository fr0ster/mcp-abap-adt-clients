/**
 * Activation Utilities - Centralized ABAP Object Activation Functions
 *
 * Two types of activation endpoints:
 * 1. Individual activation: /sap/bc/adt/activation (for single object in session)
 * 2. Group activation: /sap/bc/adt/activation/runs (for multiple objects)
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from './internalUtils';
import { getTimeout } from './timeouts';

/**
 * Build object URI from name and type
 * Used by both individual and group activation
 *
 * @param name - Object name (e.g., 'ZCL_MY_CLASS', 'Z_MY_PROGRAM')
 * @param type - Object type code (e.g., 'CLAS/OC', 'PROG/P', 'DDLS/DF')
 * @param parentName - Parent object name (e.g., function group name for FUGR/FF)
 * @returns ADT URI for the object
 */
export function buildObjectUri(
  name: string,
  type?: string,
  parentName?: string,
): string {
  const lowerName = encodeSapObjectName(name).toLowerCase();

  if (!type) {
    // Try to guess type from name prefix
    if (name.startsWith('ZCL_') || name.startsWith('CL_')) {
      return `/sap/bc/adt/oo/classes/${lowerName}`;
    } else if (name.startsWith('Z') && name.includes('_PROGRAM')) {
      return `/sap/bc/adt/programs/programs/${lowerName}`;
    }
    // Default: assume program
    return `/sap/bc/adt/programs/programs/${lowerName}`;
  }

  // Map type to URI path
  switch (type.toUpperCase()) {
    case 'CLAS/OC':
    case 'CLAS':
      return `/sap/bc/adt/oo/classes/${lowerName}`;

    case 'PROG/P':
    case 'PROG':
      return `/sap/bc/adt/programs/programs/${lowerName}`;

    case 'FUGR/FF': {
      if (parentName) {
        const lowerParent = encodeSapObjectName(parentName).toLowerCase();
        return `/sap/bc/adt/functions/groups/${lowerParent}/fmodules/${lowerName}`;
      }
      return `/sap/bc/adt/functions/groups/${lowerName}/fmodules/${lowerName}`;
    }

    case 'FUGR':
    case 'FUGR/F':
    case 'FUNC':
      return `/sap/bc/adt/functions/groups/${lowerName}`;

    case 'TABL/DT':
    case 'TABL':
      return `/sap/bc/adt/ddic/tables/${lowerName}`;

    case 'TABL/DS':
    case 'STRU/DS':
    case 'STRU':
      return `/sap/bc/adt/ddic/structures/${lowerName}`;

    case 'DDLS/DF':
    case 'DDLS':
      return `/sap/bc/adt/ddic/ddl/sources/${lowerName}`;

    case 'VIEW/DV':
    case 'VIEW':
      return `/sap/bc/adt/ddic/views/${lowerName}`;

    case 'DTEL/DE':
    case 'DTEL':
      return `/sap/bc/adt/ddic/dataelements/${lowerName}`;

    case 'DOMA/DD':
    case 'DOMA':
      return `/sap/bc/adt/ddic/domains/${lowerName}`;

    case 'INTF/OI':
    case 'INTF':
      return `/sap/bc/adt/oo/interfaces/${lowerName}`;

    case 'TTYP/DF':
    case 'TTYP/TT':
    case 'TTYP':
      return `/sap/bc/adt/ddic/tabletypes/${lowerName}`;

    case 'SRVD/SRV':
    case 'SRVD':
      return `/sap/bc/adt/ddic/srvd/sources/${lowerName}`;

    case 'SRVB/SVB':
    case 'SRVB':
      return `/sap/bc/adt/businessservices/bindings/${lowerName}`;

    case 'DDLX/EX':
    case 'DDLX':
      return `/sap/bc/adt/ddic/ddlx/sources/${lowerName}`;

    case 'BDEF/BDO':
    case 'BDEF':
      return `/sap/bc/adt/ddic/bdef/sources/${lowerName}`;

    case 'DCLS/DL':
    case 'DCLS':
      return `/sap/bc/adt/acm/dcl/sources/${lowerName}`;

    case 'ENHO/ENH':
    case 'ENHO':
      return `/sap/bc/adt/enhancements/${lowerName}`;

    default:
      // Fallback: try to construct URI from type
      return `/sap/bc/adt/${type.toLowerCase()}/${lowerName}`;
  }
}

/**
 * Individual object activation (within a session)
 * Used by Update/Create handlers after lock/unlock operations
 *
 * @param connection - ABAP connection instance
 * @param objectUri - ADT URI of the object (e.g., '/sap/bc/adt/oo/classes/zcl_test')
 * @param objectName - Object name in uppercase (e.g., 'ZCL_TEST')
 * @param sessionId - Session ID for stateful operations
 * @param preaudit - Request pre-audit before activation (default: true)
 * @returns Axios response with activation result
 */
export async function activateObjectInSession(
  connection: IAbapConnection,
  objectUri: string,
  objectName: string,
  preaudit: boolean = true,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=${preaudit}`;

  const activationXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${objectUri}" adtcore:name="${objectName}"/>
</adtcore:objectReferences>`;

  const headers = {
    'Content-Type': 'application/vnd.sap.adt.activation+xml',
    Accept: 'application/xml',
  };

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: activationXml,
    headers,
  });
}
