/**
 * Class create operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockClass } from './lock';
import { unlockClass } from './unlock';
import { activateClass } from './activation';
import { getSystemInformation } from '../shared/systemInfo';

export interface CreateClassParams {
  class_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  superclass?: string;
  final?: boolean;
  abstract?: boolean;
  create_protected?: boolean;
  source_code?: string;
  activate?: boolean;
}

/**
 * Generate minimal class source code if not provided
 */
function generateClassTemplate(className: string, description: string): string {
  return `CLASS ${className} DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
    METHODS: constructor.
  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.

CLASS ${className} IMPLEMENTATION.
  METHOD constructor.
    " ${description}
  ENDMETHOD.
ENDCLASS.`;
}

/**
 * Create class object with metadata
 */
async function createClassObject(
  connection: AbapConnection,
  args: CreateClassParams,
  sessionId: string
): Promise<AxiosResponse> {
  const description = args.description || args.class_name;
  const url = `/sap/bc/adt/oo/classes${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  // Get masterSystem and responsible
  let masterSystem = args.master_system;
  let username = args.responsible;

  if (!masterSystem || !username) {
    const systemInfo = await getSystemInformation(connection);
    if (systemInfo) {
      masterSystem = masterSystem || systemInfo.systemID;
      username = username || systemInfo.userName;
    }
  }

  masterSystem = masterSystem || process.env.SAP_SYSTEM || process.env.SAP_SYSTEM_ID || '';
  username = username || process.env.SAP_USERNAME || process.env.SAP_USER || '';

  const finalAttr = args.final ? 'true' : 'false';
  const visibilityAttr = args.create_protected ? 'protected' : 'public';

  const superClassXml = args.superclass
    ? `<class:superClassRef adtcore:name="${args.superclass}"/>`
    : '<class:superClassRef/>';

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.class_name}" adtcore:type="CLAS/OC" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr} class:final="${finalAttr}" class:visibility="${visibilityAttr}">



  <adtcore:packageRef adtcore:name="${args.package_name}"/>



  <class:include adtcore:name="CLAS/OC" adtcore:type="CLAS/OC" class:includeType="testclasses"/>



  ${superClassXml}



</class:abapClass>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.oo.classes.v4+xml',
    'Content-Type': 'application/vnd.sap.adt.oo.classes.v4+xml'
  };

  return makeAdtRequestWithSession(connection, url, 'POST', sessionId, metadataXml, headers);
}

/**
 * Upload class source code
 */
async function uploadClassSource(
  connection: AbapConnection,
  className: string,
  sourceCode: string,
  lockHandle: string,
  sessionId: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const queryParams = `lockHandle=${lockHandle}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;
  const url = `/sap/bc/adt/oo/classes/${encodeSapObjectName(className).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    'Accept': 'text/plain',
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, sourceCode, headers);
}

/**
 * Create ABAP class
 * Full workflow: create object -> lock -> upload source -> unlock -> activate
 */
export async function createClass(
  connection: AbapConnection,
  params: CreateClassParams
): Promise<AxiosResponse> {
  const className = params.class_name.toUpperCase();
  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    // Step 1: Create class object with metadata
    const createResponse = await createClassObject(connection, params, sessionId);
    if (createResponse.status < 200 || createResponse.status >= 300) {
      throw new Error(`Failed to create class object: ${createResponse.status} ${createResponse.statusText}`);
    }

    // Extract lock handle from response headers
    lockHandle = createResponse.headers['sap-adt-lockhandle'] ||
                 createResponse.headers['lockhandle'] ||
                 createResponse.headers['x-sap-adt-lockhandle'];

    if (!lockHandle) {
      // Fallback: do explicit LOCK
      lockHandle = await lockClass(connection, className, sessionId);
    }

    // Step 2: Upload source code
    const sourceCode = params.source_code || generateClassTemplate(className, params.description || className);
    const uploadResponse = await uploadClassSource(connection, className, sourceCode, lockHandle, sessionId, params.transport_request);
    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error(`Failed to upload source: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    // Step 3: Unlock the class
    await unlockClass(connection, className, lockHandle, sessionId);
    lockHandle = null;

    // Step 4: Activate the class (optional)
    const shouldActivate = params.activate !== false;
    if (shouldActivate) {
      await activateClass(connection, className, sessionId);
    }

    // Return success response
    return {
      data: {
        success: true,
        class_name: className,
        package_name: params.package_name,
        transport_request: params.transport_request || null,
        type: 'CLAS/OC',
        message: shouldActivate
          ? `Class ${className} created and activated successfully`
          : `Class ${className} created successfully (not activated)`,
        uri: `/sap/bc/adt/oo/classes/${encodeSapObjectName(className).toLowerCase()}`,
        superclass: params.superclass || null,
        final: params.final || false,
        abstract: params.abstract || false
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    // Attempt to unlock if we have a lock handle
    if (lockHandle) {
      try {
        await unlockClass(connection, className, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create class ${className}: ${errorMessage}`);
  }
}

