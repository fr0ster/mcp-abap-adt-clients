/**
 * ScalarFunction create operations - Low-level functions
 * Metadata-only POST (no source upload). Use AdtScalarFunction.update() for source.
 */
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SCALAR_FUNCTION,
  CT_SCALAR_FUNCTION,
} from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateScalarFunctionParams } from './types';

export async function create(
  connection: IAbapConnection,
  args: ICreateScalarFunctionParams,
): Promise<AxiosResponse> {
  if (!args.scalar_function_name || !args.package_name) {
    throw new Error(
      'Missing required parameters: scalar_function_name and package_name',
    );
  }

  const transport = args.transport_request?.trim();
  const url = `/sap/bc/adt/ddic/dsfd/sources${
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

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${name}" adtcore:type="DSFD/SCF" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${pkg}"/>
</blue:blueSource>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept: ACCEPT_SCALAR_FUNCTION,
      'Content-Type': CT_SCALAR_FUNCTION,
    },
  });
}
