/**
 * Type group create: one `POST` of the `atypgr:abapTypeGroup` document to the
 * collection, as measured on S/4HANA 2025 (an empty `200`; the object is then
 * inactive, its source `TYPE-POOL <name>.`).
 *
 * Every value is sent as the caller gave it, XML-escaped: no case change, no
 * truncation (the metadata advertises `descriptionTextLimit="70"`; what SAP
 * does beyond it is its own answer).
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { TYPE_GROUP } from '../../endpoints/objects';
import { createRequestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr, languageAttributes } from '../../utils/xml';
import type { ICreateTypeGroupParams } from './types';

export async function createTypeGroup(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateTypeGroupParams,
): Promise<IAdtWireResponse> {
  const corrNr = args.transport_request
    ? `?corrNr=${encodeURIComponent(args.transport_request)}`
    : '';
  const description = escapeXmlAttr(args.description ?? '');
  const name = escapeXmlAttr(args.type_group_name);
  const body = `<?xml version="1.0" encoding="UTF-8"?><atypgr:abapTypeGroup xmlns:atypgr="http://www.sap.com/adt/ddic/typegroups" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}"${languageAttributes(args.masterLanguage)} adtcore:name="${name}" adtcore:type="${TYPE_CODE.typeGroup}">
  <adtcore:packageRef adtcore:name="${escapeXmlAttr(args.package_name)}"/>
</atypgr:abapTypeGroup>`;
  return connection.makeAdtRequest({
    url: `${TYPE_GROUP.collection}${corrNr}`,
    method: 'POST',
    timeout: 0,
    data: body,
    headers: createRequestHeaders(headers, args.masterLanguage),
  });
}
