import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { CT_TRANSFORMATION } from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateTransformationParams } from './types';

/**
 * Low-level: Create transformation (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateTransformationParams,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/xslt/transformations${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const username = args.responsible || '';
  const masterSystem = args.masterSystem || '';

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(
    args.description || args.transformation_name,
  );
  const transformationName = args.transformation_name.toUpperCase();

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><trans:transformation xmlns:trans="http://www.sap.com/adt/transformation" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${transformationName}" adtcore:type="XSLT/VT" adtcore:masterLanguage="EN"${masterSystemAttr} adtcore:responsible="${username}" trans:transformationType="${args.transformation_type}">
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
