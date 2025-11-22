/**
 * Activation Utilities - Centralized ABAP Object Activation Functions
 *
 * Two types of activation endpoints:
 * 1. Individual activation: /sap/bc/adt/activation (for single object in session)
 * 2. Group activation: /sap/bc/adt/activation/runs (for multiple objects)
 */

import { AxiosResponse } from 'axios';
import { AbapConnection } from '@mcp-abap-adt/connection';
import { getTimeout } from '@mcp-abap-adt/connection';
import { encodeSapObjectName } from './internalUtils';

/**
 * Build object URI from name and type
 * Used by both individual and group activation
 *
 * @param name - Object name (e.g., 'ZCL_MY_CLASS', 'Z_MY_PROGRAM')
 * @param type - Object type code (e.g., 'CLAS/OC', 'PROG/P', 'DDLS/DF')
 * @returns ADT URI for the object
 */
export function buildObjectUri(name: string, type?: string): string {
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

    case 'FUGR':
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
  connection: AbapConnection,
  objectUri: string,
  objectName: string,
  preaudit: boolean = true
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=${preaudit}`;

  const activationXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${objectUri}" adtcore:name="${objectName}"/>
</adtcore:objectReferences>`;

  const headers = {
    'Content-Type': 'application/vnd.sap.adt.activation+xml',
    'Accept': 'application/xml'
  };

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: activationXml,
    headers
  });
}
