/**
 * Domain create operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { DOMAIN } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { createRequestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr, languageAttributes } from '../../utils/xml';
import type { ICreateDomainParams } from './types';

/**
 * Create empty domain (initial POST to register the name)
 * Low-level function - creates domain without locking
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateDomainParams,
): Promise<IAdtWireResponse> {
  const corrNrParam = args.transport_request
    ? `?corrNr=${args.transport_request}`
    : '';
  const url = `${DOMAIN.collection}${corrNrParam}`;

  const masterSystem = args.masterSystem || '';
  const username = args.responsible || '';

  // Cut first, escaped after: an entity is never cut in two.
  const description = escapeXmlAttr(
    limitDescription(args.description || args.domain_name),
  );

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(masterSystem)}"`
    : '';
  const responsibleAttr = username
    ? ` adtcore:responsible="${escapeXmlAttr(username)}"`
    : '';
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}"${languageAttributes(args.masterLanguage)} adtcore:name="${escapeXmlAttr(args.domain_name.toUpperCase())}" adtcore:type="${TYPE_CODE.domain}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${escapeXmlAttr(args.package_name.toUpperCase())}"/>
</doma:domain>`;

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: createRequestHeaders(headers, args.masterLanguage),
  });
}
