/**
 * Group Activation operations - activate multiple objects with session support
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { buildObjectUri } from '../../utils/activationUtils';
import { IObjectReference } from './types';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

/**
 * Extract run ID from location header
 */
function extractRunId(location: string | undefined): string | null {
  if (!location) return null;
  const match = location.match(/\/activation\/runs\/([^\/]+)/);
  return match ? match[1] : null;
}

/**
 * Wait for activation run to complete by polling status
 */
async function waitForActivationRun(
  connection: IAbapConnection,
  runId: string,
  maxWaitTime: number = 60000,
  pollInterval: number = 1000
): Promise<AxiosResponse> {
  const startTime = Date.now();
  const url = `/sap/bc/adt/activation/runs/${runId}?withLongPolling=true`;

  while (Date.now() - startTime < maxWaitTime) {
    const response = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        'Accept': 'application/xml, application/vnd.sap.adt.backgroundrun.v1+xml'
      }
    });

    const parsed = xmlParser.parse(response.data);
    const run = parsed['runs:run'] || parsed['run'] || parsed['@_runs:run'];
    if (!run) {
      throw new Error('Invalid activation run response format');
    }

    // Try different ways to extract status attribute
    // XMLParser with attributeNamePrefix: '@_' will parse attributes like runs:status as @_runs:status
    const status = run['@_runs:status'] || 
                   run['@_status'] || 
                   run['status'];
    
    const progressPercentage = run['@_runs:progressPercentage'] || 
                               run['@_progressPercentage'] || 
                               run['progressPercentage'];

    if (status === 'finished') {
      return response;
    }

    if (status === 'error' || status === 'failed') {
      throw new Error(`Activation run failed with status: ${status}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Activation run timeout after ${maxWaitTime}ms`);
}

/**
 * Get activation results
 */
async function getActivationResults(
  connection: IAbapConnection,
  runId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/activation/results/${runId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Activate multiple objects in a group (with session support)
 * 
 * Implements the EclipseADT activation flow:
 * 1. POST /sap/bc/adt/activation/runs?method=activate&preauditRequested=false - Start activation
 * 2. GET /sap/bc/adt/activation/runs/{runId}?withLongPolling=true - Poll for completion
 * 3. GET /sap/bc/adt/activation/results/{runId} - Get activation results
 * 4. GET /sap/bc/adt/activation/inactiveobjects - Check for remaining inactive objects
 * 
 * This function allows activating multiple objects of different types in a single request.
 * Useful for activating related objects together (e.g., BDEF + CDS view).
 * 
 * @param connection - ABAP connection instance
 * @param objects - Array of objects to activate
 * @param preauditRequested - Request pre-audit before activation (default: false)
 * @returns Axios response with activation result (from step 3 - activation results)
 * 
 * @example
 * ```typescript
 * // Activate BDEF and related CDS view together
 * const objects = [
 *   {
 *     type: 'BDEF/BDO',
 *     name: 'ZOK_I_CDS_TEST'
 *   },
 *   {
 *     type: 'DDLS/DF',
 *     name: 'ZOK_C_CDS_TEST'
 *   }
 * ];
 * 
 * const result = await activateObjectsGroup(connection, objects);
 * ```
 */
export async function activateObjectsGroup(
    connection: IAbapConnection,
    objects: IObjectReference[],
    preauditRequested: boolean = false
): Promise<AxiosResponse> {
    // Step 1: Start activation run
    const url = `/sap/bc/adt/activation/runs?method=activate&preauditRequested=${preauditRequested}`;

    // Build object references XML
    const objectReferences = objects.map(obj => {
        const uri = buildObjectUri(obj.name, obj.type);
        const typeAttr = obj.type ? ` adtcore:type="${obj.type}"` : '';
        return `  <adtcore:objectReference adtcore:uri="${uri}"${typeAttr} adtcore:name="${obj.name}"/>`;
    }).join('\n');

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objectReferences}
</adtcore:objectReferences>`;

    const headers = {
        'Accept': 'application/xml',
        'Content-Type': 'application/xml'
    };

    const startResponse = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: getTimeout('default'),
        data: xmlBody,
        headers
    });

    // Extract run ID from location header
    const location = startResponse.headers?.['location'] || 
                     startResponse.headers?.['Location'] ||
                     startResponse.headers?.['content-location'] ||
                     startResponse.headers?.['Content-Location'];
    
    const runId = extractRunId(location);
    if (!runId) {
        throw new Error('Failed to extract activation run ID from response headers');
    }

    // Step 2: Wait for activation to complete
    await waitForActivationRun(connection, runId);

    // Step 3: Get activation results
    const resultsResponse = await getActivationResults(connection, runId);

    // Step 4: Check for remaining inactive objects to verify activation success
    // If activation completed successfully, there should be no inactive objects
    try {
        const inactiveResponse = await connection.makeAdtRequest({
            method: 'GET',
            url: '/sap/bc/adt/activation/inactiveobjects',
            timeout: getTimeout('default'),
            headers: {
                'Accept': 'application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8'
            }
        });
        
        const inactiveParsed = xmlParser.parse(inactiveResponse.data);
        const inactiveRoot = inactiveParsed['ioc:inactiveObjects'];
        
        if (inactiveRoot) {
            const inactiveObjects = inactiveRoot['ioc:entry'] || [];
            const inactiveArray = Array.isArray(inactiveObjects) ? inactiveObjects : (inactiveObjects ? [inactiveObjects] : []);
            
            if (inactiveArray.length > 0) {
                // Check if any of the requested objects are still inactive
                const requestedObjectKeys = new Set(
                    objects.map(obj => `${obj.type || ''}/${obj.name || ''}`.toLowerCase())
                );
                
                const failedObjects: string[] = [];
                inactiveArray.forEach((entry: any) => {
                    const obj = entry['ioc:object']?.['ioc:ref'];
                    if (obj) {
                        const objType = obj['@_adtcore:type'] || '';
                        const objName = obj['@_adtcore:name'] || '';
                        const objKey = `${objType}/${objName}`.toLowerCase();
                        
                        // Only report objects that were requested for activation
                        if (requestedObjectKeys.has(objKey)) {
                            failedObjects.push(`${objType}/${objName}`);
                        }
                    }
                });
                
                if (failedObjects.length > 0) {
                    throw new Error(`Activation failed. Remaining inactive objects: ${failedObjects.join(', ')}`);
                }
            }
        }
    } catch (error: any) {
        // If checking inactive objects fails, check if it's our error or a network error
        if (error.message && error.message.includes('Remaining inactive objects')) {
            throw error;
        }
        // If it's a network error, log but don't fail - the activation might have succeeded
        // The results response will be returned anyway
    }

    return resultsResponse;
}
