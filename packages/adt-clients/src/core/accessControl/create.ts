import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { ACCESS_CONTROL } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateAccessControlParams } from './types';

/**
 * Low-level: Create access control (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateAccessControlParams,
): Promise<IAdtWireResponse> {
  const url = `${ACCESS_CONTROL.collection}${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const username = escapeXmlAttr(args.responsible || '');
  const masterSystem = escapeXmlAttr(args.masterSystem || '');

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(
    args.description || args.access_control_name,
  );
  const accessControlName = args.access_control_name.toUpperCase();

  // Absent means absent: an empty attribute is not "no responsible person".
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><dcl:dclSource xmlns:dcl="http://www.sap.com/adt/acm/dclsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${accessControlName}" adtcore:type="${TYPE_CODE.accessControl}" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</dcl:dclSource>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });
}
