import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_TRANSFORMATION } from '../../constants/contentTypes';
import { TRANSFORMATION } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateTransformationParams } from './types';

/**
 * Low-level: Create transformation (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateTransformationParams,
): Promise<IAdtWireResponse> {
  const url = `${TRANSFORMATION.collection}${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const username = escapeXmlAttr(args.responsible || '');
  const masterSystem = escapeXmlAttr(args.masterSystem || '');

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(
    args.description || args.transformation_name,
  );
  const transformationName = args.transformation_name.toUpperCase();

  // Absent means absent: an empty attribute is not "no responsible person".
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><trans:transformation xmlns:trans="http://www.sap.com/adt/transformation" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${transformationName}" adtcore:type="XSLT/VT" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr} trans:transformationType="${args.transformation_type}">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</trans:transformation>`;

  const headers = {
    Accept: CT_TRANSFORMATION,
    'Content-Type': CT_TRANSFORMATION,
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
