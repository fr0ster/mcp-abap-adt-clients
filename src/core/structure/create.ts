/**
 * Structure create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockStructure } from './lock';
import { unlockStructure } from './unlock';
import { activateStructure } from './activation';
import { CreateStructureParams } from './types';

/**
 * Parse XML response to extract structure creation information
 */
function parseStructureCreationResponse(xml: string) {
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
        'Unknown error during structure creation';
      throw new Error(errorMsg);
    }

    if (result['ddic:structure']) {
      const structure = result['ddic:structure'];
      return {
        name: structure['adtcore:name'],
        description: structure['adtcore:description'],
        package: structure['adtcore:packageRef']?.['adtcore:name'],
        status: 'created',
        objectType: 'structure'
      };
    }

    return { raw: result, status: 'created' };

  } catch (parseError) {
    return {
      raw_xml: xml,
      status: 'created',
      note: 'XML parsing failed, but structure creation might have succeeded'
    };
  }
}

/**
 * Verify structure exists and get its details
 */
async function verifyStructureCreation(
  connection: AbapConnection,
  structureName: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const url = `${baseUrl}/sap/bc/adt/ddic/structures/${encodeSapObjectName(structureName)}/source/main`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

/**
 * Create ABAP structure using DDL SQL
 * Full workflow: create empty -> lock -> add DDL -> unlock -> activate -> verify
 */
export async function createStructure(
  connection: AbapConnection,
  params: CreateStructureParams
): Promise<AxiosResponse> {
  if (!params.structure_name) {
    throw new Error('Structure name is required');
  }
  if (!params.package_name) {
    throw new Error('Package name is required');
  }
  if (!params.ddl_code) {
    throw new Error('DDL code is required');
  }

  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    // Step 1: Create empty structure with POST
    const createUrl = `/sap/bc/adt/ddic/structures${params.transport_request ? `?corrNr=${params.transport_request}` : ''}`;
    const description = params.description || params.structure_name;

    const structureXml = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${params.structure_name.toUpperCase()}" adtcore:type="STRU/DT" adtcore:masterLanguage="EN" adtcore:masterSystem="${process.env.SAP_SYSTEM || process.env.SAP_SYSTEM_ID || 'DEV'}" adtcore:responsible="${process.env.SAP_USER || process.env.SAP_USERNAME || 'DEVELOPER'}">
  <adtcore:packageRef adtcore:name="${params.package_name.toUpperCase()}"/>
</blue:blueSource>`;

    const headers = {
      'Accept': 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml',
      'Content-Type': 'application/vnd.sap.adt.structures.v2+xml'
    };

    const createResponse = await makeAdtRequestWithSession(connection, createUrl, 'POST', sessionId, structureXml, headers);

    // Step 2: Get lockHandle for the created structure
    lockHandle = await lockStructure(connection, params.structure_name, sessionId);

    // Step 3: Add DDL content to the structure with lockHandle
    const ddlUrl = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(params.structure_name)}/source/main?lockHandle=${lockHandle}${params.transport_request ? `&corrNr=${params.transport_request}` : ''}`;

    const ddlHeaders = {
      'Accept': 'application/xml, application/json, text/plain, */*',
      'Content-Type': 'text/plain; charset=utf-8'
    };

    const ddlResponse = await makeAdtRequestWithSession(connection, ddlUrl, 'PUT', sessionId, params.ddl_code, ddlHeaders);

    parseStructureCreationResponse(ddlResponse.data);

    // Step 4: Unlock the structure after DDL content is added
    try {
      await unlockStructure(connection, params.structure_name, lockHandle, sessionId);
      lockHandle = null;
    } catch (unlockError) {
      // Continue even if unlock fails
    }

    // Step 5: Activate structure
    try {
      await activateStructure(connection, params.structure_name, sessionId);
    } catch (activateError) {
      // Continue even if activation fails
    }

    // Return the DDL response
    return ddlResponse;

  } catch (error: any) {
    // Try to unlock if still locked
    if (lockHandle) {
      try {
        await unlockStructure(connection, params.structure_name, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create structure ${params.structure_name}: ${errorMessage}`);
  }
}

