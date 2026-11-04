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
/**
 * No `program:programType`: SAP ignores it on create (measured on premise,
 * 2026-11-04 — a create carrying `modulePool`, `subroutinePool`, `M` or `F`
 * read back `executableProgram`, and one without the attribute answered `200`
 * and read back the same). A program's type is set afterwards.
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

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><program:abapProgram xmlns:program="http://www.sap.com/adt/programs/programs" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}"${languageAttributes(args.masterLanguage)} adtcore:name="${escapeXmlAttr(args.programName)}" adtcore:type="${TYPE_CODE.program}"${masterSystemAttr}${responsibleAttr} program:application="${escapeXmlAttr(application)}">
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
