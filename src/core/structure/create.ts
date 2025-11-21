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
 * Create empty structure metadata via POST
 * Low-level function - creates metadata without DDL content
 */
export async function create(
  connection: AbapConnection,
  structureName: string,
  description: string,
  packageName: string,
  transportRequest: string | undefined,
  sessionId: string
): Promise<AxiosResponse> {
  const createUrl = `/sap/bc/adt/ddic/structures${transportRequest ? `?corrNr=${transportRequest}` : ''}`;

  const structureXml = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${structureName.toUpperCase()}" adtcore:type="STRU/DT" adtcore:masterLanguage="EN" adtcore:masterSystem="${process.env.SAP_SYSTEM || process.env.SAP_SYSTEM_ID || 'DEV'}" adtcore:responsible="${process.env.SAP_USER || process.env.SAP_USERNAME || 'DEVELOPER'}">
  <adtcore:packageRef adtcore:name="${packageName.toUpperCase()}"/>
</blue:blueSource>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.structures.v2+xml',
    'Content-Type': 'application/vnd.sap.adt.structures.v2+xml'
  };

  return makeAdtRequestWithSession(connection, createUrl, 'POST', sessionId, structureXml, headers);
}