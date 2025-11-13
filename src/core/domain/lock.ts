/**
 * Domain lock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { CreateDomainParams } from './types';

/**
 * Acquire lock handle by attempting to lock the domain (for create)
 */
export async function acquireLockHandle(
  connection: AbapConnection,
  args: CreateDomainParams,
  sessionId: string
): Promise<string> {
  const domainNameEncoded = encodeSapObjectName(args.domain_name.toLowerCase());

  const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
  };

  try {
    const response = await makeAdtRequestWithSession(connection, url, 'POST', sessionId, null, headers);

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });

    const result = parser.parse(response.data);
    const lockHandle = result?.['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];

    if (!lockHandle) {
      throw new Error('Failed to obtain lock handle from SAP response');
    }

    return lockHandle;
  } catch (error: any) {
    if (error.response?.data?.includes('ExceptionResourceAlreadyExists')) {
      throw new Error(
        `Domain ${args.domain_name} already exists. Please delete it first or use a different name.`
      );
    }

    throw new Error(
      `Failed to create empty domain ${args.domain_name}: ${error.message || error}`
    );
  }
}

/**
 * Acquire lock handle for update
 */
export async function acquireLockHandleForUpdate(
  connection: AbapConnection,
  domainName: string,
  sessionId: string
): Promise<string> {
  const domainNameEncoded = encodeSapObjectName(domainName.toLowerCase());
  const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
  };

  const response = await makeAdtRequestWithSession(connection, url, 'POST', sessionId, null, headers);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ''
  });

  const result = parser.parse(response.data);
  const lockHandle = result['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];

  if (!lockHandle) {
    throw new Error('Failed to extract lock handle from response');
  }

  return lockHandle;
}

