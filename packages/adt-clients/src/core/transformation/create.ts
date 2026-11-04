import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { TRANSFORMATION } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { createRequestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr, languageAttributes } from '../../utils/xml';
import type { ICreateTransformationParams } from './types';

/**
 * Low-level: Create transformation (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateTransformationParams,
): Promise<IAdtWireResponse> {
  const url = `${TRANSFORMATION.collection}${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const username = escapeXmlAttr(args.responsible || '');
  const masterSystem = escapeXmlAttr(args.masterSystem || '');

  // Description is limited to 60 characters in SAP ADT
  // Cut first, escaped after: an entity is never cut in two.
  const description = escapeXmlAttr(
    limitDescription(args.description || args.transformation_name),
  );
  const transformationName = escapeXmlAttr(
    args.transformation_name.toUpperCase(),
  );

  // Absent means absent: an empty attribute is not "no responsible person".
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><trans:transformation xmlns:trans="http://www.sap.com/adt/transformation" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}"${languageAttributes(args.masterLanguage)} adtcore:name="${transformationName}" adtcore:type="${TYPE_CODE.transformation}"${masterSystemAttr}${responsibleAttr} trans:transformationType="${args.transformation_type}">
  <adtcore:packageRef adtcore:name="${escapeXmlAttr(args.package_name.toUpperCase())}"/>
</trans:transformation>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: createRequestHeaders(headers, args.masterLanguage),
  });
}
