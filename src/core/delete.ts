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

  // Normalize object type (order matters! Check longer patterns first)
  const type = objectType.toLowerCase()
    .replace('clas/oc', 'class')
    .replace('prog/p', 'program')
    .replace('intf/oi', 'interface')
    .replace('fugr/ff', 'function_module')  // Check this BEFORE 'fugr/f'
    .replace('fugr/f', 'function_group')
    .replace('tabl/dt', 'table')
    .replace('stru/dt', 'structure')  // STRU/DT is used for structures
    .replace('ttyp/st', 'structure')
    .replace('ddls/df', 'view')
    .replace('dtel/de', 'data_element')
    .replace('doma/dd', 'domain')  // DOMA/DD is also used for domains
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
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
    case 'domain':
      return `/sap/bc/adt/ddic/domains/${encodedName}`;
    case 'data_element':
      return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    default:
      throw new Error(`Unsupported object type: ${objectType}`);
  }
}

/**
 * Check if object can be deleted (deletion check)
 */
export async function checkDeletion(
  connection: AbapConnection,
  params: DeleteObjectParams
): Promise<AxiosResponse> {
  const {
    object_name,
    object_type,
    function_group_name
  } = params;

  // Validation
  if (!object_name || !object_type) {
    throw new Error('object_name and object_type are required');
  }

  // Build object URI from object_name and object_type
  const objectUri = getObjectUri(object_type, object_name, function_group_name);

  const baseUrl = await connection.getBaseUrl();
  const checkUrl = `${baseUrl}/sap/bc/adt/deletion/check`;

  // Build XML check request (no transportNumber in check request)
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.deletion.check.request.v1+xml'
  };

  return await connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers
  });
}

/**
 * Delete ABAP object using ADT deletion API
 * For some object types (like interfaces), empty transportNumber tag is required
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
  // For interfaces and some other object types, empty transportNumber tag is required
  // For structures, empty tag causes failure, so we omit it entirely
  const normalizedType = object_type.toLowerCase();
  const requiresEmptyTransportTag = normalizedType.includes('intf') ||
                                    normalizedType.includes('clas') ||
                                    normalizedType.includes('prog');

  let transportNumberTag = '';
  if (transport_request && transport_request.trim()) {
    transportNumberTag = `<del:transportNumber>${transport_request}</del:transportNumber>`;
  } else if (requiresEmptyTransportTag) {
    // For interfaces, classes, programs: add empty self-closing tag
    transportNumberTag = '<del:transportNumber/>';
  }
  // For structures and other types: omit tag entirely if no transport_request

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}">
    ${transportNumberTag}
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

