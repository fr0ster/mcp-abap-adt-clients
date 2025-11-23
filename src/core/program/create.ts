/**
 * Program create operations - Low-level functions
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { lockProgram } from './lock';
import { unlockProgram } from './unlock';
import { activateProgram } from './activation';
import { getSystemInformation } from '../../utils/systemInfo';

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
 * Low-level: Create program object with metadata (POST)
 * Does NOT lock/upload/activate - just creates the object
 */
export async function create(
  connection: AbapConnection,
  args: CreateProgramParams
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

  return connection.makeAdtRequest({url, method: 'POST', timeout: getTimeout('default'), data: metadataXml, headers});
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

  return connection.makeAdtRequest({url, method: 'PUT', timeout: getTimeout('default'), data: sourceCode, headers});
}
