/**
 * Package transport check operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import {
  ACCEPT_TRANSPORT_CHECK,
  CT_TRANSPORT_CHECK,
} from '../../constants/contentTypes';
import {
  buildQueryString,
  encodeSapObjectName,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreatePackageParams } from './types';

/**
 * Step 2: Check transport requirements
 */
export async function checkTransportRequirements(
  connection: IAbapConnection,
  args: ICreatePackageParams,
  transportLayer: string,
): Promise<string[]> {
  const qs = buildQueryString({ transportLayer });
  const url = `/sap/bc/adt/cts/transportchecks?${qs}`;
  const encodedPackageName = encodeSapObjectName(
    args.package_name.toLowerCase(),
  );

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
    <DATA>
      <PGMID/>
      <OBJECT/>
      <OBJECTNAME/>
      <DEVCLASS>${args.package_name}</DEVCLASS>
      <SUPER_PACKAGE>${args.super_package}</SUPER_PACKAGE>
      <RECORD_CHANGES/>
      <OPERATION>I</OPERATION>
      <URI>/sap/bc/adt/packages/${encodedPackageName}</URI>
    </DATA>
  </asx:values>
</asx:abap>`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept: ACCEPT_TRANSPORT_CHECK,
      'Content-Type': CT_TRANSPORT_CHECK,
    },
  });

  const parser = new XMLParser({ ignoreAttributes: false });
  const result = parser.parse(response.data);
  const data = result['asx:abap']?.['asx:values']?.DATA;

  if (data?.RESULT !== 'S') {
    throw new Error('Transport check failed');
  }

  const requests = data?.REQUESTS?.CTS_REQUEST || [];
  const transportList = Array.isArray(requests) ? requests : [requests];
  const transportNumbers = transportList
    .map(
      (req: Record<string, unknown>) =>
        (req.REQ_HEADER as Record<string, unknown>)?.TRKORR as string,
    )
    .filter((trkorr: string) => trkorr);

  return transportNumbers;
}
