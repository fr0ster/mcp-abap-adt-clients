/**
 * Program create operations - Low-level functions
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { PROGRAM } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { createRequestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr, languageAttributes } from '../../utils/xml';
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

  // SAP's words, as its own program metadata states them (read on premise,
  // 2026-11-04): `executableProgram`, `modulePool`, `subroutinePool`. A
  // function group's, class pool's or interface pool's main program is no
  // `programs/programs` resource there (its metadata read answers 404 or
  // 500), so no word was read for those three; they keep the letters sent
  // before. Measured on the same system: the create took none of these — a
  // program created with `modulePool`, `subroutinePool`, `M` or `F` read back
  // `executableProgram` (TRDIR-SUBC 1). Which type a create makes is SAP's.
  const typeMap: Record<string, string> = {
    executable: 'executableProgram',
    module_pool: 'modulePool',
    subroutine_pool: 'subroutinePool',
    function_group: 'F',
    class_pool: 'K',
    interface_pool: 'J',
  };

  return typeMap[programType || 'executable'] || 'executableProgram';
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
  headers: IAdtHeaders,
  args: ICreateProgramParams,
): Promise<IAdtWireResponse> {
  // Description is limited to 60 characters in SAP ADT
  // Cut first, escaped after: an entity is never cut in two.
  const description = escapeXmlAttr(
    limitDescription(args.description || args.programName),
  );
  const programType = convertProgramType(args.programType);
  const application = args.application || '*';
  const url = `${PROGRAM.collection}${args.transportRequest ? `?corrNr=${args.transportRequest}` : ''}`;

  const masterSystem = args.masterSystem || '';
  const username = args.responsible || '';

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(masterSystem)}"`
    : '';
  const responsibleAttr = username
    ? ` adtcore:responsible="${escapeXmlAttr(username)}"`
    : '';

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}"${languageAttributes(args.masterLanguage)} adtcore:name="${escapeXmlAttr(args.programName)}" adtcore:type="${TYPE_CODE.program}"${masterSystemAttr}${responsibleAttr} program:programType="${escapeXmlAttr(programType)}" program:application="${escapeXmlAttr(application)}">
  <adtcore:packageRef adtcore:name="${escapeXmlAttr(args.packageName)}"/>
</program:abapProgram>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: metadataXml,
    headers: createRequestHeaders(headers, args.masterLanguage),
  });
}
