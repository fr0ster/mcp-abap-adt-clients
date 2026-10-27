/**
 * ScalarFunction create operations - Low-level functions
 * Metadata-only POST (no source upload). Use AdtScalarFunction.update() for source.
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { SCALAR_FUNCTION } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateScalarFunctionParams } from './types';

export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateScalarFunctionParams,
): Promise<IAdtWireResponse> {
  if (!args.scalar_function_name || !args.package_name) {
    throw new Error(
      'Missing required parameters: scalar_function_name and package_name',
    );
  }

  const transport = args.transport_request?.trim();
  const url = `${SCALAR_FUNCTION.collection}${
    transport ? `?corrNr=${encodeURIComponent(transport)}` : ''
  }`;

  const lang = args.masterLanguage || 'EN';
  const name = escapeXmlAttr(args.scalar_function_name.toUpperCase());
  const pkg = escapeXmlAttr(args.package_name.toUpperCase());
  const description = escapeXmlAttr(
    limitDescription(args.description || args.scalar_function_name),
  );
  const masterSystemAttr = args.masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(args.masterSystem)}"`
    : '';
  const responsibleAttr = args.responsible
    ? ` adtcore:responsible="${escapeXmlAttr(args.responsible)}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${name}" adtcore:type="${TYPE_CODE.scalarFunction}" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
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
