/**
 * Table create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { acquireTableLockHandle } from './lock';
import { unlockTable, deleteTableLock } from './unlock';
import { activateTable } from './activation';
import { runTableCheckRun } from './check';
import { CreateTableParams } from './types';

/**
 * Parse XML response to extract table creation information
 */
function parseTableCreationResponse(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
    trimValues: true
  });

  try {
    const result = parser.parse(xml);

    if (result.error || result['asx:abap']?.['asx:values']?.ERROR) {
      const errorMsg = result.error?.message ||
        result['asx:abap']?.['asx:values']?.ERROR?.MESSAGE ||
        'Unknown error during table creation';
      throw new Error(errorMsg);
    }

    if (result['ddic:table']) {
      const table = result['ddic:table'];
      return {
        name: table['adtcore:name'],
        description: table['adtcore:description'],
        package: table['adtcore:packageRef']?.['adtcore:name'],
        status: 'created',
        objectType: 'table'
      };
    }

    return { raw: result, status: 'created' };

  } catch (parseError) {
    return {
      raw_xml: xml,
      status: 'created',
      note: 'XML parsing failed, but table creation might have succeeded'
    };
  }
}

/**
 * Verify table exists and get its details
 */
async function verifyTableCreation(
  connection: AbapConnection,
  tableName: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const url = `${baseUrl}/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName)}/source/main`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

/**
 * Create ABAP table
 * Full workflow: create empty -> check status -> lock -> add DDL -> check -> unlock -> activate -> verify
 */
export async function createTable(
  connection: AbapConnection,
  params: CreateTableParams
): Promise<AxiosResponse> {
  if (!params.table_name) {
    throw new Error('Table name is required');
  }
  if (!params.ddl_code) {
    throw new Error('DDL code is required');
  }
  if (!params.package_name) {
    throw new Error('Package name is required');
  }

  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    // Step 1: Create empty table with POST
    const createUrl = `/sap/bc/adt/ddic/tables${params.transport_request ? `?corrNr=${params.transport_request}` : ''}`;

    const tableXml = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${params.table_name}" adtcore:language="EN" adtcore:name="${params.table_name.toUpperCase()}" adtcore:type="TABL/DT" adtcore:masterLanguage="EN" adtcore:masterSystem="${process.env.SAP_SYSTEM || process.env.SAP_SYSTEM_ID || 'DEV'}" adtcore:responsible="${process.env.SAP_USER || process.env.SAP_USERNAME || 'DEVELOPER'}">

  <adtcore:packageRef adtcore:name="${params.package_name.toUpperCase()}"/>

</blue:blueSource>`;

    const headers = {
      'Accept': 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.tables.v2+xml',
      'Content-Type': 'application/vnd.sap.adt.tables.v2+xml'
    };

    const createResponse = await makeAdtRequestWithSession(connection, createUrl, 'POST', sessionId, tableXml, headers);

    // Step 1.1: Run table status check before locking (optional, continue on error)
    try {
      await runTableCheckRun(connection, 'tableStatusCheck', params.table_name, sessionId);
    } catch (statusError) {
      // Continue even if status check fails
    }

    // Step 1.2: Get lockHandle for the created table
    lockHandle = await acquireTableLockHandle(connection, params.table_name, sessionId);

    // Step 1.3: Add DDL content to the table with lockHandle
    const ddlUrl = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(params.table_name)}/source/main?lockHandle=${lockHandle}${params.transport_request ? `&corrNr=${params.transport_request}` : ''}`;

    const ddlHeaders = {
      'Accept': 'application/xml, application/json, text/plain, */*',
      'Content-Type': 'text/plain; charset=utf-8'
    };

    const ddlResponse = await makeAdtRequestWithSession(connection, ddlUrl, 'PUT', sessionId, params.ddl_code, ddlHeaders);

    parseTableCreationResponse(ddlResponse.data);

    // Step 1.3.1: Run ABAP check before unlock (optional, continue on error)
    try {
      await runTableCheckRun(connection, 'abapCheckRun', params.table_name, sessionId);
    } catch (checkError) {
      // Continue even if check fails
    }

    // Step 1.4: Unlock the table after DDL content is added
    try {
      await unlockTable(connection, params.table_name, lockHandle, sessionId);
      lockHandle = null;
    } catch (unlockError) {
      try {
        await deleteTableLock(connection, params.table_name);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    // Step 2: Activate table
    let activationAttempt = 0;
    const maxActivationAttempts = 2;

    while (activationAttempt < maxActivationAttempts) {
      activationAttempt++;

      try {
        await activateTable(connection, params.table_name, sessionId);
        break;
      } catch (attemptError: any) {
        if (attemptError.response?.data?.includes('No active nametab')) {
          try {
            await runTableCheckRun(connection, 'abapCheckRun', params.table_name, sessionId);
          } catch (retryCheckError) {
            // Ignore
          }
          if (activationAttempt < maxActivationAttempts) {
            continue;
          }
        }

        if (activationAttempt >= maxActivationAttempts) {
          break;
        }

        throw attemptError;
      }
    }

    // Return the real response from SAP (from initial POST)
    return createResponse;

  } catch (error: any) {
    // Try to unlock if we have a lock handle
    if (lockHandle) {
      try {
        await unlockTable(connection, params.table_name, lockHandle, sessionId);
      } catch (unlockError) {
        try {
          await deleteTableLock(connection, params.table_name);
        } catch (cleanupError) {
          // Ignore
        }
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create table ${params.table_name}: ${errorMessage}`);
  }
}

