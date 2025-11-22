/**
 * Package transport check operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { XMLParser } from 'fast-xml-parser';
import { CreatePackageParams } from './types';

/**
 * Step 2: Check transport requirements
 */
export async function checkTransportRequirements(
  connection: AbapConnection,
  args: CreatePackageParams,
  transportLayer: string
): Promise<string[]> {
  const url = `/sap/bc/adt/cts/transportchecks`;

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
      <URI>/sap/bc/adt/packages/${args.package_name.toLowerCase()}</URI>
    </DATA>
  </asx:values>
</asx:abap>`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    params: { transportLayer },
    headers: {
      'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.transport.service.checkData',
      'Content-Type': 'application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.transport.service.checkData'
    }
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
    .map((req: any) => req.REQ_HEADER?.TRKORR)
    .filter((trkorr: any) => trkorr);

  return transportNumbers;
}

