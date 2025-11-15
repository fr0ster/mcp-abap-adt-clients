/**
 * Domain create operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { acquireLockHandle } from './lock';
import { unlockDomain } from './unlock';
import { activateDomain } from './activation';
import { checkDomainSyntax } from './check';
import { getSystemInformation } from '../shared/systemInfo';
import { CreateDomainParams } from './types';

/**
 * Create empty domain (initial POST to register the name)
 */
export async function createEmptyDomain(
  connection: AbapConnection,
  args: CreateDomainParams,
  sessionId: string,
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

  return makeAdtRequestWithSession(connection, url, 'POST', sessionId, xmlBody, headers);
}

/**
 * Create domain with lock handle
 * Build XML from scratch using parameters
 */
export async function lockAndCreateDomain(
  connection: AbapConnection,
  args: CreateDomainParams,
  lockHandle: string,
  sessionId: string,
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

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, xmlBody, headers);
}

/**
 * Get domain to verify creation
 */
async function getDomainForVerification(
  connection: AbapConnection,
  domainName: string,
  sessionId: string
): Promise<any> {
  const domainNameEncoded = encodeSapObjectName(domainName.toLowerCase());
  const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}?version=workingArea`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.domains.v1+xml, application/vnd.sap.adt.domains.v2+xml'
  };

  const response = await makeAdtRequestWithSession(connection, url, 'GET', sessionId, undefined, headers);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const result = parser.parse(response.data);
  return result['doma:domain'];
}

/**
 * Create ABAP domain
 * Full workflow: create empty -> lock -> create with data -> check -> unlock -> activate
 */
export async function createDomain(
  connection: AbapConnection,
  params: CreateDomainParams
): Promise<AxiosResponse> {
  if (!params.domain_name) {
    throw new Error('Domain name is required');
  }
  if (!params.package_name) {
    throw new Error('Package name is required');
  }

  if (params.domain_name.length > 30) {
    throw new Error('Domain name must not exceed 30 characters');
  }

  const sessionId = generateSessionId();

  // Get masterSystem and responsible (only for cloud systems)
  // On cloud, getSystemInformation returns systemID and userName
  // On on-premise, it returns null, so we don't add these attributes
  const systemInfo = await getSystemInformation(connection);
  const masterSystem = systemInfo?.systemID;
  const username = systemInfo?.userName || process.env.SAP_USER || process.env.SAP_USERNAME || 'MPCUSER';

  let lockHandle = '';

  try {
    // Step 1: Create empty domain
    await createEmptyDomain(connection, params, sessionId, username, masterSystem);

    // Step 2: Acquire lock
    lockHandle = await acquireLockHandle(connection, params, sessionId);

    await new Promise(resolve => setTimeout(resolve, 500));
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Create domain with full data
    await lockAndCreateDomain(connection, params, lockHandle, sessionId, username, masterSystem);

    // Step 4: Check domain validity (inactive version after creation)
    await checkDomainSyntax(connection, params.domain_name, 'inactive', sessionId);

    // Step 5: Unlock domain
    await unlockDomain(connection, params.domain_name, lockHandle, sessionId);

    // Step 6: Activate domain (optional, default true)
    const shouldActivate = params.activate !== false;
    if (shouldActivate) {
      await activateDomain(connection, params.domain_name, sessionId);
    }

    // Step 7: Verify creation
    const finalDomain = await getDomainForVerification(connection, params.domain_name, sessionId);

    // Return success response
    return {
      data: {
        success: true,
        domain_name: params.domain_name,
        package: params.package_name,
        transport_request: params.transport_request,
        status: shouldActivate ? 'active' : 'inactive',
        session_id: sessionId,
        message: `Domain ${params.domain_name} created${shouldActivate ? ' and activated' : ''} successfully`,
        domain_details: finalDomain
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    // Try to unlock if we have a lock handle
    if (lockHandle) {
      try {
        await unlockDomain(connection, params.domain_name, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create domain ${params.domain_name}: ${errorMessage}`);
  }
}

