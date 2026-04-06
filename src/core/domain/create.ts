/**
 * Domain create operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_DOMAIN, CT_DOMAIN } from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateDomainParams } from './types';

/**
 * Create empty domain (initial POST to register the name)
 * Low-level function - creates domain without locking
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateDomainParams,
): Promise<AxiosResponse> {
  const corrNrParam = args.transport_request
    ? `?corrNr=${args.transport_request}`
    : '';
  const url = `/sap/bc/adt/ddic/domains${corrNrParam}`;

  const masterSystem = args.masterSystem || '';
  const username = args.responsible || '';

  const description = limitDescription(args.description || args.domain_name);

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${args.domain_name.toUpperCase()}" adtcore:type="DOMA/DD" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</doma:domain>`;

  const headers = {
    Accept: ACCEPT_DOMAIN,
    'Content-Type': CT_DOMAIN,
  };

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
