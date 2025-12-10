/**
 * Domain update operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName, limitDescription } from '../../utils/internalUtils';
import { IUpdateDomainParams } from './types';

/**
 * Update domain with new data
 * 
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updateDomain(
  connection: IAbapConnection,
  args: IUpdateDomainParams,
  lockHandle: string,
  username: string,
  masterSystem?: string
): Promise<AxiosResponse> {
  const domainNameEncoded = encodeSapObjectName(args.domain_name.toLowerCase());

  const corrNrParam = args.transport_request ? `&corrNr=${args.transport_request}` : '';
  const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}?lockHandle=${lockHandle}${corrNrParam}`;

  const datatype = args.datatype || 'CHAR';
  const length = args.length || 100;
  const decimals = args.decimals || 0;

  let fixValuesXml = '';
  if (args.fixed_values && args.fixed_values.length > 0) {
    const fixValueItems = args.fixed_values.map(fv =>
      `      <doma:fixValue>\n        <doma:low>${fv.low}</doma:low>\n        <doma:text>${fv.text}</doma:text>\n      </doma:fixValue>`
    ).join('\n');
    fixValuesXml = `    <doma:fixValues>\n${fixValueItems}\n    </doma:fixValues>`;
  } else {
    fixValuesXml = '    <doma:fixValues/>';
  }

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(args.description || args.domain_name);
  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<doma:domain xmlns:doma="http://www.sap.com/dictionary/domain"
             xmlns:adtcore="http://www.sap.com/adt/core"
             adtcore:description="${description}"
             adtcore:language="EN"
             adtcore:name="${args.domain_name.toUpperCase()}"
             adtcore:type="DOMA/DD"
             adtcore:masterLanguage="EN"${masterSystemAttr}
             adtcore:responsible="${username}">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
  <doma:content>
    <doma:typeInformation>
      <doma:datatype>${datatype}</doma:datatype>
      <doma:length>${length}</doma:length>
      <doma:decimals>${decimals}</doma:decimals>
    </doma:typeInformation>
    <doma:outputInformation>
      <doma:length>${length}</doma:length>
      <doma:conversionExit>${args.conversion_exit || ''}</doma:conversionExit>
      <doma:signExists>${args.sign_exists || false}</doma:signExists>
      <doma:lowercase>${args.lowercase || false}</doma:lowercase>
    </doma:outputInformation>
    <doma:valueInformation>
      <doma:valueTableRef adtcore:name="${args.value_table || ''}"/>
      <doma:appendExists>false</doma:appendExists>
${fixValuesXml}
    </doma:valueInformation>
  </doma:content>
</doma:domain>`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.sap.adt.domains.v1+xml, application/vnd.sap.adt.domains.v2+xml',
    'Content-Type': 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8'
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers
  });
}

