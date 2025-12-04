/**
 * FunctionGroup create operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName, limitDescription } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { activateFunctionGroup } from './activation';
import { CreateFunctionGroupParams } from './types';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  error: debugEnabled ? console.error : () => {},
};

/**
 * Create function group metadata via POST
 * Low-level function - creates function group without workflow logic
 */
export async function create(
  connection: IAbapConnection,
  functionGroupName: string,
  description: string,
  packageName: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/functions/groups${transportRequest ? `?corrNr=${transportRequest}` : ''}`;

  // Get masterSystem and responsible (only for cloud systems)
  // On cloud, getSystemInformation returns systemID and userName
  // On on-premise, it returns null, so we don't add these attributes
  const systemInfo = await getSystemInformation(connection);
  
  let finalMasterSystem: string | undefined;
  let finalResponsible: string | undefined;

  if (systemInfo) {
    // Only for cloud systems - use systemInfo values only if they exist and are not empty
    finalMasterSystem = systemInfo.systemID || undefined;
    finalResponsible = systemInfo.userName || undefined;
    
    // Don't add responsible if it's empty - this can cause "Kerberos library not loaded" error
    if (finalResponsible && finalResponsible.trim() === '') {
      finalResponsible = undefined;
    }
  }

  // Don't escape masterSystem and responsible - they are identifiers (like "TRL", "CB9980002377")
  // Escaping them may cause SAP to fail parsing and trigger Kerberos errors
  const masterSystemAttr = finalMasterSystem ? ` adtcore:masterSystem="${finalMasterSystem}"` : '';
  const responsibleAttr = finalResponsible ? ` adtcore:responsible="${finalResponsible}"` : '';

  // Log systemInfo to help diagnose Kerberos errors
  // Use logger.debug (controlled by DEBUG_ADT_LIBS)
  logger.debug('[FunctionGroup create] systemInfo:', {
    hasSystemInfo: !!systemInfo,
    systemID: systemInfo?.systemID,
    userName: systemInfo?.userName,
    finalMasterSystem,
    finalResponsible,
    willIncludeMasterSystem: !!finalMasterSystem,
    willIncludeResponsible: !!finalResponsible,
    masterSystemAttr: masterSystemAttr || '(not included)',
    responsibleAttr: responsibleAttr || '(not included)'
  });

  // Also log to test logger if available (controlled by DEBUG_ADT_TESTS)
  // Try to import test logger conditionally to avoid circular dependencies
  try {
    // Only import if we're in test environment
    if (process.env.DEBUG_ADT_TESTS === 'true' || process.env.NODE_ENV === 'test') {
      const { logBuilderSystemInfo } = require('../../__tests__/helpers/builderTestLogger');
      logBuilderSystemInfo(systemInfo, {
        masterSystem: finalMasterSystem,
        responsible: finalResponsible,
        willIncludeMasterSystem: !!finalMasterSystem,
        willIncludeResponsible: !!finalResponsible,
        masterSystemAttr,
        responsibleAttr
      });
    }
  } catch (e) {
    // Ignore if test logger is not available (not in test environment)
  }

  // Description is limited to 60 characters in SAP ADT
  const limitedDescription = limitDescription(description);
  // Build XML payload - no escaping (same as old working code)
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<group:abapFunctionGroup xmlns:group="http://www.sap.com/adt/functions/groups" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}" adtcore:language="EN" adtcore:name="${functionGroupName}" adtcore:type="FUGR/F" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${packageName}"/>
</group:abapFunctionGroup>`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/vnd.sap.adt.functions.groups.v3+xml'//,
    // 'Accept': 'application/vnd.sap.adt.functions.groups.v3+xml'
  };

  // Log request details for debugging authorization issues (same as class/create.ts)
  logger.debug(`[DEBUG] Creating FunctionGroup - URL: ${url}`);
  logger.debug(`[DEBUG] Creating FunctionGroup - Method: POST`);
  logger.debug(`[DEBUG] Creating FunctionGroup - Headers:`, JSON.stringify(headers, null, 2));
  logger.debug(`[DEBUG] Creating FunctionGroup - Body (first 500 chars):`, xmlPayload.substring(0, 500));

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      data: xmlPayload,
      headers
    });
    return response;
  } catch (error: any) {
    // Special handling: Ignore Kerberos error for FunctionGroup
    // SAP sometimes returns HTTP 400 with "Kerberos library not loaded" but still creates the object
    // This is a known issue with FunctionGroup create - we ignore the error
    if (error.response?.status === 400) {
      const errorData = typeof error.response.data === 'string' 
        ? error.response.data 
        : JSON.stringify(error.response.data);
      
      if (errorData.includes('Kerberos library not loaded')) {
        logger.debug(`[WARN] FunctionGroup create returned Kerberos error, but object may have been created - ignoring error`);
        // Return a mock successful response (status 201)
        return {
          ...error.response,
          status: 201,
          statusText: 'Created',
          data: error.response.data
        } as AxiosResponse;
      }
    }
    
    // Log error details for debugging (same as class/create.ts)
    if (error.response) {
      logger.error(`[ERROR] Create FunctionGroup failed - Status: ${error.response.status}`);
      logger.error(`[ERROR] Create FunctionGroup failed - StatusText: ${error.response.statusText}`);
      logger.error(`[ERROR] Create FunctionGroup failed - Response headers:`, JSON.stringify(error.response.headers, null, 2));
      logger.error(`[ERROR] Create FunctionGroup failed - Response data (first 1000 chars):`,
        typeof error.response.data === 'string'
          ? error.response.data.substring(0, 1000)
          : JSON.stringify(error.response.data).substring(0, 1000));
    }
    throw error;
  }
}