/**
 * Program create operations - Low-level functions
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SOURCE,
  CT_PROGRAM,
  CT_SOURCE,
} from '../../constants/contentTypes';
import {
  encodeSapObjectName,
  limitDescription,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IAdtContentTypes } from '../shared/contentTypes';
import type { ICreateProgramParams } from './types';

/**
 * Convert readable program type to SAP internal code
 */
function convertProgramType(programType?: string): string {
  const typeMap: Record<string, string> = {
    executable: '1',
    include: 'I',
    module_pool: 'M',
    function_group: 'F',
    class_pool: 'K',
    interface_pool: 'J',
  };

  return typeMap[programType || 'executable'] || '1';
}

/**
 * Generate minimal program source code if not provided
 */
function _generateProgramTemplate(
  programName: string,
  programType: string,
  description: string,
): string {
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
  connection: IAbapConnection,
  args: ICreateProgramParams,
  contentTypes?: IAdtContentTypes,
): Promise<AxiosResponse> {
  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(args.description || args.programName);
  const programType = convertProgramType(args.programType);
  const application = args.application || '*';
  const url = `/sap/bc/adt/programs/programs${args.transportRequest ? `?corrNr=${args.transportRequest}` : ''}`;

  const masterSystem = args.masterSystem || '';
  const username = args.responsible || '';

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.programName}" adtcore:type="PROG/P" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr} program:programType="${programType}" program:application="${application}">
  <adtcore:packageRef adtcore:name="${args.packageName}"/>
</program:abapProgram>`;

  const ct = contentTypes?.programCreate();
  const headers = {
    Accept: ct?.accept || CT_PROGRAM,
    'Content-Type': ct?.contentType || CT_PROGRAM,
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: metadataXml,
    headers,
  });
}

/**
 * Upload program source code
 */
async function _uploadProgramSource(
  connection: IAbapConnection,
  programName: string,
  sourceCode: string,
  lockHandle: string,
  _sessionId: string,
  transportRequest?: string,
): Promise<AxiosResponse> {
  const queryParams = `lockHandle=${encodeURIComponent(lockHandle)}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;
  const url = `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    Accept: ACCEPT_SOURCE,
    'Content-Type': CT_SOURCE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers,
  });
}
