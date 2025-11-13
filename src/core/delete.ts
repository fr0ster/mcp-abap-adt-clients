/**
 * Delete operations - Common deletion logic for all object types
 * All functions extracted 1:1 from handlers, adapted to accept connection as parameter
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../utils/internalUtils';

export interface DeleteObjectParams {
  object_name: string;
  object_type: string;
  function_group_name?: string;
  transport_request?: string;
}

/**
 * Get ADT URI for object
 */
function getObjectUri(
  objectType: string,
  objectName: string,
  functionGroupName?: string
): string {
  const encodedName = encodeSapObjectName(objectName);

  // Normalize object type
  const type = objectType.toLowerCase()
    .replace('clas/oc', 'class')
    .replace('prog/p', 'program')
    .replace('intf/oi', 'interface')
    .replace('fugr/f', 'function_group')
    .replace('fugr/ff', 'function_module')
    .replace('tabl/dt', 'table')
    .replace('ttyp/st', 'structure')
    .replace('ddls/df', 'view')
    .replace('dtel/de', 'data_element')
    .replace('doma/dm', 'domain');

  switch (type) {
    case 'class':
      return `/sap/bc/adt/oo/classes/${encodedName}`;
    case 'program':
      return `/sap/bc/adt/programs/programs/${encodedName}`;
    case 'interface':
      return `/sap/bc/adt/oo/interfaces/${encodedName}`;
    case 'function_group':
      return `/sap/bc/adt/functions/groups/${encodedName}`;
    case 'function_module':
      if (!functionGroupName) {
        throw new Error('function_group_name is required for function_module deletion');
      }
      const encodedGroupName = encodeSapObjectName(functionGroupName);
      return `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedName}`;
    case 'table':
      return `/sap/bc/adt/ddic/tables/${encodedName}`;
    case 'structure':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
    case 'view':
      return `/sap/bc/adt/ddic/ddlsources/${encodedName}`;
    case 'domain':
      return `/sap/bc/adt/ddic/domains/${encodedName}`;
    case 'data_element':
      return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    default:
      throw new Error(`Unsupported object type: ${objectType}`);
  }
}

/**
 * Delete ABAP object using ADT deletion API
 */
export async function deleteObject(
  connection: AbapConnection,
  params: DeleteObjectParams
): Promise<AxiosResponse> {
  const {
    object_name,
    object_type,
    function_group_name,
    transport_request
  } = params;

  // Validation
  if (!object_name || !object_type) {
    throw new Error('object_name and object_type are required');
  }

  // Build object URI from object_name and object_type
  const objectUri = getObjectUri(object_type, object_name, function_group_name);

  const baseUrl = await connection.getBaseUrl();
  const deletionUrl = `${baseUrl}/sap/bc/adt/deletion/delete`;

  // Build XML deletion request
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}">
    ${transport_request ? `<del:transportNumber>${transport_request}</del:transportNumber>` : ''}
  </del:object>
</del:deletionRequest>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.deletion.response.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.deletion.request.v1+xml'
  };

  const response = await connection.makeAdtRequest({
    url: deletionUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers
  });

  // Return success response
  return {
    ...response,
    data: {
      success: true,
      object_name,
      object_type,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `Object ${object_name} deleted successfully`
    }
  } as AxiosResponse;
}

