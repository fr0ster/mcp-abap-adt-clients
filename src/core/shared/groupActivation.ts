/**
 * Group Activation operations - activate multiple objects with session support
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { buildObjectUri } from '../../utils/activationUtils';
import { headerValueToString } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IObjectReference } from './types';

const _xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

type AdtHeaderValue = IAdtWireResponse['headers'][string];

/**
 * Extract run ID from location header
 */
/**
 * The run id ADT puts in the `Location` header of a started activation.
 *
 * Exported because `activateObjectsGroup` is the POST and nothing else since
 * 19.0.0: the caller takes the id from the answer, decides how long to wait,
 * and asks {@link getActivationResults} when they are ready. Waiting on an
 * asynchronous job is theirs, not this package's.
 */
export function extractRunId(
  location: AdtHeaderValue | undefined,
): string | null {
  const locationValue = headerValueToString(location);
  if (!locationValue) return null;
  const match = locationValue.match(/\/activation\/runs\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * What an activation run is doing — `/activation/runs/{runId}`.
 *
 * One request, and the document as it arrived. `withLongPolling` reaches the
 * wire, so it is a parameter: the server holds the request open rather than
 * answering immediately, which is how a caller waits without a tight loop.
 *
 * **The reading is the caller's.** The document carries `runs:status` —
 * `finished`, `error`, `failed`, or a progress percentage while it runs — and
 * which of those ends a wait is their decision. This package used to loop here
 * with a sixty-second ceiling and a one-second interval, treat `error` and
 * `failed` as a thrown exception, and answer nothing about the rest.
 */
export async function getActivationRun(
  connection: IAbapConnection,
  runId: string,
  options?: { withLongPolling?: boolean },
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';

  return connection.makeAdtRequest({
    url: `/sap/bc/adt/activation/runs/${runId}${query}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml, application/vnd.sap.adt.backgroundrun.v1+xml',
    },
  });
}

/**
 * Get activation results
 */
export async function getActivationResults(
  connection: IAbapConnection,
  runId: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/activation/results/${runId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
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
 *     name: 'ZDEMO_I_CDS_VIEW'
 *   },
 *   {
 *     type: 'DDLS/DF',
 *     name: 'ZDEMO_C_CDS_VIEW'
 *   }
 * ];
 *
 * const result = await activateObjectsGroup(connection, objects);
 * ```
 */
export async function activateObjectsGroup(
  connection: IAbapConnection,
  objects: IObjectReference[],
  preauditRequested: boolean = false,
): Promise<IAdtWireResponse> {
  // Step 1: Start activation run
  const url = `/sap/bc/adt/activation/runs?method=activate&preauditRequested=${preauditRequested}`;

  // Build object references XML
  const objectReferences = objects
    .map((obj) => {
      const uri = buildObjectUri(obj.name, obj.type, obj.parentName);
      const typeAttr = obj.type ? ` adtcore:type="${obj.type}"` : '';
      return `  <adtcore:objectReference adtcore:uri="${uri}"${typeAttr} adtcore:name="${obj.name}"/>`;
    })
    .join('\n');

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objectReferences}
</adtcore:objectReferences>`;

  const headers = {
    Accept: 'application/xml',
    'Content-Type': 'application/xml',
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
