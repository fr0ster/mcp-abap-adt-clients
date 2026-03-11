/**
 * Domain update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields that would be lost if XML were built from scratch.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_DOMAIN } from '../../constants/contentTypes';
import {
  encodeSapObjectName,
  limitDescription,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import {
  extractXmlString,
  patchIf,
  patchXmlAttribute,
  patchXmlBlock,
  patchXmlElement,
  patchXmlElementAttribute,
} from '../../utils/xmlPatch';
import type { IUpdateDomainParams } from './types';

/**
 * Patch current domain XML with updated values.
 * Only modifies fields that are explicitly provided in args.
 */
function patchDomainXml(currentXml: string, args: IUpdateDomainParams): string {
  let xml = currentXml;

  // Description
  if (args.description) {
    const description = limitDescription(args.description);
    xml = patchXmlAttribute(xml, 'adtcore:description', description);
  }

  // Type information
  xml = patchIf(xml, args.datatype, (x, val) =>
    patchXmlElement(x, 'doma:datatype', val),
  );
  xml = patchIf(xml, args.length, (x, val) =>
    patchXmlElement(x, 'doma:length', String(val)),
  );
  xml = patchIf(xml, args.decimals, (x, val) =>
    patchXmlElement(x, 'doma:decimals', String(val)),
  );

  // Output information
  if (args.conversion_exit !== undefined) {
    xml = patchXmlElement(
      xml,
      'doma:conversionExit',
      args.conversion_exit || '',
    );
  }
  if (args.sign_exists !== undefined) {
    xml = patchXmlElement(xml, 'doma:signExists', String(args.sign_exists));
  }
  if (args.lowercase !== undefined) {
    xml = patchXmlElement(xml, 'doma:lowercase', String(args.lowercase));
  }

  // Value table
  if (args.value_table !== undefined) {
    xml = patchXmlElementAttribute(
      xml,
      'doma:valueTableRef',
      'adtcore:name',
      args.value_table || '',
    );
  }

  // Fixed values — replace entire block
  if (args.fixed_values !== undefined) {
    if (args.fixed_values && args.fixed_values.length > 0) {
      const fixValueItems = args.fixed_values
        .map(
          (fv) =>
            `      <doma:fixValue>\n        <doma:low>${fv.low}</doma:low>\n        <doma:text>${fv.text}</doma:text>\n      </doma:fixValue>`,
        )
        .join('\n');
      const fixValuesBlock = `<doma:fixValues>\n${fixValueItems}\n    </doma:fixValues>`;
      xml = patchXmlBlock(xml, 'doma:fixValues', fixValuesBlock);
    } else {
      xml = patchXmlBlock(xml, 'doma:fixValues', '<doma:fixValues/>');
    }
  }

  return xml;
}

/**
 * Update domain with new data (read-modify-write pattern)
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updateDomain(
  connection: IAbapConnection,
  args: IUpdateDomainParams,
  lockHandle: string,
): Promise<AxiosResponse> {
  const domainNameEncoded = encodeSapObjectName(args.domain_name.toLowerCase());

  // 1. GET current XML
  const currentResponse = await connection.makeAdtRequest({
    url: `/sap/bc/adt/ddic/domains/${domainNameEncoded}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_DOMAIN },
  });
  const currentXml = extractXmlString(currentResponse.data);

  // 2. Patch only changed fields
  const updatedXml = patchDomainXml(currentXml, args);

  // 3. PUT
  const corrNrParam = args.transport_request
    ? `&corrNr=${args.transport_request}`
    : '';
  const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;

  const headers: Record<string, string> = {
    Accept: ACCEPT_DOMAIN,
    'Content-Type': 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: updatedXml,
    headers,
  });
}
