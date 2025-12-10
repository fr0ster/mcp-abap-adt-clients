/**
 * Domain create operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName, limitDescription } from '../../utils/internalUtils';
import { acquireLockHandle } from './lock';
import { unlockDomain } from './unlock';
import { activateDomain } from './activation';
import { checkDomainSyntax } from './check';
import { getSystemInformation } from '../../utils/systemInfo';
import { ICreateDomainParams } from './types';

/**
 * Create empty domain (initial POST to register the name)
 * Low-level function - creates domain without locking
 * 
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateDomainParams,
  username: string,
  masterSystem?: string
): Promise<AxiosResponse> {
  const corrNrParam = args.transport_request ? `?corrNr=${args.transport_request}` : '';
  const url = `/sap/bc/adt/ddic/domains${corrNrParam}`;

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<doma:domain xmlns:doma="http://www.sap.com/dictionary/domain"
             xmlns:adtcore="http://www.sap.com/adt/core"
             adtcore:description="${args.description || args.domain_name}"
             adtcore:language="EN"
             adtcore:name="${args.domain_name.toUpperCase()}"
             adtcore:type="DOMA/DD"
             adtcore:masterLanguage="EN"${masterSystemAttr}
             adtcore:responsible="${username}">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</doma:domain>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.domains.v1+xml, application/vnd.sap.adt.domains.v2+xml',
    'Content-Type': 'application/vnd.sap.adt.domains.v2+xml'
  };

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers
  });
}
