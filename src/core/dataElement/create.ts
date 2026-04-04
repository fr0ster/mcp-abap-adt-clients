/**
 * DataElement create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 *
 * Create sends minimal XML (root element + packageRef only).
 * Type details (typeKind, labels, etc.) are set via update after creation,
 * matching Eclipse ADT behavior.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DATA_ELEMENT,
  CT_DATA_ELEMENT,
} from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateDataElementParams } from './types';

/**
 * Low-level: Create data element (POST)
 * Does NOT activate - just creates the object with minimal metadata.
 * Type information and labels should be set via updateDataElement() afterwards.
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateDataElementParams,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/dataelements${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const username = args.responsible || '';
  const masterSystem = args.masterSystem || '';

  const description = limitDescription(
    args.description || args.data_element_name,
  );

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:wbobj xmlns:blue="http://www.sap.com/wbobj/dictionary/dtel" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.data_element_name.toUpperCase()}" adtcore:type="DTEL/DE" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</blue:wbobj>`;

  const headers = {
    Accept: ACCEPT_DATA_ELEMENT,
    'Content-Type': CT_DATA_ELEMENT,
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
