/**
 * Domain create operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
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
): Promise<IAdtWireResponse> {
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
  // **The type, when the caller named one.** A domain created without it comes
  // back with `<doma:datatype/>` empty and cannot be activated: SAP answers the
  // activation with `DO(251) Data type ' ' does not exist`. Measured on a cloud
  // trial on 2026-09-22, beside a domain whose type was in this body — `201`,
  // the document read back as `CHAR`/`000010`, and the activation reported no
  // messages at all.
  //
  // Absent, the element is absent: the body is then byte for byte the one this
  // function has always sent, which is what keeps a system this was not
  // measured on — every on-premise one — exactly where it was.
  //
  // The lengths are the six digits the server itself serialises.
  const digits = (value: number): string => String(value).padStart(6, '0');
  const typeInformation =
    args.datatype === undefined &&
    args.length === undefined &&
    args.decimals === undefined
      ? ''
      : `
  <doma:content>
    <doma:typeInformation>
      <doma:datatype>${args.datatype ?? ''}</doma:datatype>
      <doma:length>${digits(args.length ?? 0)}</doma:length>
      <doma:decimals>${digits(args.decimals ?? 0)}</doma:decimals>
    </doma:typeInformation>
  </doma:content>`;

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><doma:domain xmlns:doma="http://www.sap.com/dictionary/domain" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${args.domain_name.toUpperCase()}" adtcore:type="DOMA/DD" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>${typeInformation}
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
