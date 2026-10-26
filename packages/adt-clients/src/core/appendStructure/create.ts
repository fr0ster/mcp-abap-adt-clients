/**
 * AppendStructure create operations - Low-level functions
 * Metadata-only POST with base_structure template; source via update().
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { STRUCTURE } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateAppendStructureParams } from './types';

export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateAppendStructureParams,
): Promise<IAdtWireResponse> {
  if (!args.append_structure_name || !args.base_object || !args.package_name) {
    throw new Error(
      'Missing required parameters: append_structure_name, base_object, package_name',
    );
  }

  const transport = args.transport_request?.trim();
  const url = `${STRUCTURE.collection}${
    transport ? `?corrNr=${encodeURIComponent(transport)}` : ''
  }`;

  const lang = args.masterLanguage || 'EN';
  const name = escapeXmlAttr(args.append_structure_name.toUpperCase());
  const base = escapeXmlAttr(args.base_object.toUpperCase());
  const pkg = escapeXmlAttr(args.package_name.toUpperCase());
  const description = escapeXmlAttr(
    limitDescription(args.description || args.append_structure_name),
  );
  const masterSystemAttr = args.masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(args.masterSystem)}"`
    : '';
  const responsibleAttr = args.responsible
    ? ` adtcore:responsible="${escapeXmlAttr(args.responsible)}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${name}" adtcore:type="TABL/DS" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:adtTemplate>
    <adtcore:adtProperty adtcore:key="base_structure">${base}</adtcore:adtProperty>
  </adtcore:adtTemplate>
  <adtcore:packageRef adtcore:name="${pkg}"/>
</blue:blueSource>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });
}
