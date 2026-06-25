/**
 * ScalarFunctionImplementation create operations - Low-level functions
 * Metadata-only POST (blues v2 + server-driven content linking to the scalar function).
 */
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SCALAR_FUNCTION_IMPL,
  CT_SCALAR_FUNCTION_IMPL,
} from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { escapeXmlAttr } from '../../utils/xml';
import type {
  ICreateScalarFunctionImplementationParams,
  ScalarFunctionEngine,
} from './types';

/** base64 of {"scalarFunctionName":<upper>,"engineValue":<engine>} (key order fixed). */
export function buildServerDrivenContent(
  scalarFunctionName: string,
  engineValue: ScalarFunctionEngine,
): string {
  const json = JSON.stringify({
    scalarFunctionName: scalarFunctionName.toUpperCase(),
    engineValue,
  });
  return Buffer.from(json, 'utf-8').toString('base64');
}

export async function create(
  connection: IAbapConnection,
  args: ICreateScalarFunctionImplementationParams,
): Promise<AxiosResponse> {
  if (
    !args.implementation_name ||
    !args.scalar_function_name ||
    !args.package_name
  ) {
    throw new Error(
      'Missing required parameters: implementation_name, scalar_function_name and package_name',
    );
  }

  const transport = args.transport_request?.trim();
  const url = `/sap/bc/adt/ddic/dsfi${transport ? `?corrNr=${encodeURIComponent(transport)}` : ''}`;

  const lang = args.masterLanguage || 'EN';
  const name = escapeXmlAttr(args.implementation_name.toUpperCase());
  const pkg = escapeXmlAttr(args.package_name.toUpperCase());
  const description = escapeXmlAttr(
    limitDescription(args.description || args.implementation_name),
  );
  const masterSystemAttr = args.masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(args.masterSystem)}"`
    : '';
  const responsibleAttr = args.responsible
    ? ` adtcore:responsible="${escapeXmlAttr(args.responsible)}"`
    : '';
  const content = buildServerDrivenContent(
    args.scalar_function_name,
    args.engine_value || 'sqlEngine',
  );

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${name}" adtcore:type="DSFI/SFI" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${pkg}"/>
  <blue:additionalCreationProperties>
    <adtcore:content adtcore:encoding="base64" adtcore:type="application/vnd.sap.adt.serverdriven.content.v1+json">${content}</adtcore:content>
  </blue:additionalCreationProperties>
</blue:blueSource>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept: ACCEPT_SCALAR_FUNCTION_IMPL,
      'Content-Type': CT_SCALAR_FUNCTION_IMPL,
    },
  });
}
