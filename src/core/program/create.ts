/**
 * Program create operations - Low-level functions
 */

import type {
  IAbapConnection,
  IAdtContentTypes,
  IAdtWireResponse,
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
import type { ICreateProgramParams } from './types';

/**
 * Convert readable program type to SAP internal code
 */
function convertProgramType(programType?: string): string {
  if (programType === 'include') {
    // This mapped to 'I' and then posted a `program:abapProgram` document with
    // `adtcore:type="PROG/P"` to the programs collection. A standalone include
    // is a different resource: `include:abapInclude`, its own namespace,
    // `PROG/I`, its own collection, and a different accepted content type. The
    // mapping was not a parameter that needed correcting; it was the wrong
    // object. Measured against a captured Eclipse create.
    throw new Error(
      "programType 'include' is not a program. A standalone PROG/I include is " +
        'a separate resource — use AdtClient.getInclude() (src/core/include).',
    );
  }

  const typeMap: Record<string, string> = {
    executable: '1',
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
): Promise<IAdtWireResponse> {
  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(args.description || args.programName);
  const programType = convertProgramType(args.programType);
  const application = args.application || '*';
  const url = `/sap/bc/adt/programs/programs${args.transportRequest ? `?corrNr=${args.transportRequest}` : ''}`;

  const masterSystem = args.masterSystem || '';
  const username = args.responsible || '';
  const lang = args.masterLanguage || 'EN';

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${args.programName}" adtcore:type="PROG/P" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr} program:programType="${programType}" program:application="${application}">
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
): Promise<IAdtWireResponse> {
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
