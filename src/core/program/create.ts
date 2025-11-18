/**
 * Program create operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockProgram } from './lock';
import { unlockProgram } from './unlock';
import { activateProgram } from './activation';
import { getSystemInformation } from '../shared/systemInfo';

export interface CreateProgramParams {
  program_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  program_type?: string;
  application?: string;
  source_code?: string;
  activate?: boolean;
}

/**
 * Convert readable program type to SAP internal code
 */
function convertProgramType(programType?: string): string {
  const typeMap: Record<string, string> = {
    'executable': '1',
    'include': 'I',
    'module_pool': 'M',
    'function_group': 'F',
    'class_pool': 'K',
    'interface_pool': 'J'
  };

  return typeMap[programType || 'executable'] || '1';
}

/**
 * Generate minimal program source code if not provided
 */
function generateProgramTemplate(programName: string, programType: string, description: string): string {
  const upperName = programName.toUpperCase();

  switch (programType) {
    case 'I': // Include
      return `*&---------------------------------------------------------------------*
*& Include ${upperName}
*& ${description}
*&---------------------------------------------------------------------*

" Include program logic here
`;

    case 'M': // Module Pool
      return `*&---------------------------------------------------------------------*
*& Module Pool ${upperName}
*& ${description}
*&---------------------------------------------------------------------*

PROGRAM ${upperName}.
`;

    case '1': // Executable (Report)
    default:
      return `*&---------------------------------------------------------------------*
*& Report ${upperName}
*& ${description}
*&---------------------------------------------------------------------*
REPORT ${upperName}.

START-OF-SELECTION.
  WRITE: / 'Program ${upperName} executed successfully.'.
`;
  }
}

/**
 * Create program object with metadata
 */
async function createProgramObject(
  connection: AbapConnection,
  args: CreateProgramParams,
  sessionId: string
): Promise<AxiosResponse> {
  const description = args.description || args.program_name;
  const programType = convertProgramType(args.program_type);
  const application = args.application || '*';
  const url = `/sap/bc/adt/programs/programs${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  // Get masterSystem and responsible (only for cloud systems)
  // On cloud, getSystemInformation returns systemID and userName
  // On on-premise, it returns null, so we don't add these attributes
  let masterSystem = args.master_system;
  let username = args.responsible;

  const systemInfo = await getSystemInformation(connection);
  if (systemInfo) {
    masterSystem = masterSystem || systemInfo.systemID;
    username = username || systemInfo.userName;
  }

  // Only use masterSystem from getSystemInformation (cloud), not from env
  // username can fallback to env if not provided
  username = username || process.env.SAP_USERNAME || process.env.SAP_USER || '';

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.program_name}" adtcore:type="PROG/P" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr} program:programType="${programType}" program:application="${application}">
  <adtcore:packageRef adtcore:name="${args.package_name}"/>
</program:abapProgram>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.programs.programs.v2+xml',
    'Content-Type': 'application/vnd.sap.adt.programs.programs.v2+xml'
  };

  return makeAdtRequestWithSession(connection, url, 'POST', sessionId, metadataXml, headers);
}

/**
 * Upload program source code
 */
async function uploadProgramSource(
  connection: AbapConnection,
  programName: string,
  sourceCode: string,
  lockHandle: string,
  sessionId: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const queryParams = `lockHandle=${lockHandle}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;
  const url = `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    'Accept': 'text/plain',
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, sourceCode, headers);
}

/**
 * Create ABAP program
 * Full workflow: create object -> lock -> upload source -> unlock -> activate
 */
export async function createProgram(
  connection: AbapConnection,
  params: CreateProgramParams
): Promise<AxiosResponse> {
  const programName = params.program_name.toUpperCase();
  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    // Step 1: Create program object with metadata
    const createResponse = await createProgramObject(connection, params, sessionId);
    if (createResponse.status < 200 || createResponse.status >= 300) {
      throw new Error(`Failed to create program object: ${createResponse.status} ${createResponse.statusText}`);
    }

    // Extract lock handle from response headers
    lockHandle = createResponse.headers['sap-adt-lockhandle'] ||
                 createResponse.headers['lockhandle'] ||
                 createResponse.headers['x-sap-adt-lockhandle'];

    if (!lockHandle) {
      // Fallback: do explicit LOCK
      lockHandle = await lockProgram(connection, programName, sessionId);
    }

    // Step 2: Upload source code
    const programType = convertProgramType(params.program_type);
    const sourceCode = params.source_code || generateProgramTemplate(programName, programType, params.description || programName);
    const uploadResponse = await uploadProgramSource(connection, programName, sourceCode, lockHandle, sessionId, params.transport_request);
    if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
      throw new Error(`Failed to upload source: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    // Step 3: Unlock the program
    await unlockProgram(connection, programName, lockHandle, sessionId);
    lockHandle = null;

    // Step 4: Activate the program (optional)
    const shouldActivate = params.activate !== false;
    if (shouldActivate) {
      await activateProgram(connection, programName, sessionId);
    }

    // Return the real response from SAP (from initial POST)
    return createResponse;

  } catch (error: any) {
    // Attempt to unlock if we have a lock handle
    if (lockHandle) {
      try {
        await unlockProgram(connection, programName, lockHandle, sessionId);
      } catch (unlockError: any) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data || error.message || 'Unknown error';
    throw new Error(`Failed to create program ${programName}: ${errorMessage}`);
  }
}

