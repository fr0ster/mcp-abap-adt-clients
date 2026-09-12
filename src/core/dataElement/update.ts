/**
 * DataElement update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields that would be lost if XML were built from scratch.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DATA_ELEMENT,
  ACCEPT_DOMAIN,
} from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateDataElementParams } from './types';

const _debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';

/**
 * Get domain info to extract dataType, length, decimals
 */
export async function getDomainInfo(
  connection: IAbapConnection,
  domainName: string,
): Promise<{ dataType: string; length: number; decimals: number }> {
  const { XMLParser } = await import('fast-xml-parser');
  const domainNameEncoded = encodeSapObjectName(domainName.toLowerCase());
  const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}`;

  const headers = {
    Accept: ACCEPT_DOMAIN,
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers,
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const result = parser.parse(response.data);
  const domainXml = result['doma:domain'];

  return {
    dataType:
      domainXml['doma:content']?.['doma:typeInformation']?.['doma:datatype'] ||
      'CHAR',
    length:
      domainXml['doma:content']?.['doma:typeInformation']?.['doma:length'] ||
      100,
    decimals:
      domainXml['doma:content']?.['doma:typeInformation']?.['doma:decimals'] ||
      0,
  };
}

/**
 * Write the document the caller built.
 *
 * **One request.** This used to GET the current document, patch the named
 * fields into it, and PUT the result — two requests in one member, and a merge
 * whose rules nobody outside could change. A caller reads the document with the
 * member that reads it, edits it, and passes it here, which is also where the
 * guarantee that it is valid belongs.
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateDataElement(
  connection: IAbapConnection,
  params: IUpdateDataElementParams,
  document: string,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(
    params.data_element_name.toLowerCase(),
  );
  const url = `/sap/bc/adt/ddic/dataelements/${encodedName}${writeQuery(lockHandle, params.transport_request)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: {
      Accept: ACCEPT_DATA_ELEMENT,
      'Content-Type':
        'application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8',
    },
  });
}
