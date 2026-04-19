/**
 * FunctionInclude (FUGR/I) metadata update operations.
 *
 * Requires a valid lockHandle (acquired via lockFunctionInclude).
 * Body is identical to create; only the URL differs (PUT to single-object URL
 * with ?lockHandle=...).
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_FUNCTION_INCLUDE,
  CT_FUNCTION_INCLUDE,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateFunctionIncludeParams } from './types';
import { buildFunctionIncludeXml } from './xmlBuilder';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';

/**
 * Update function include metadata via PUT.
 */
export async function updateFunctionInclude(
  connection: IAbapConnection,
  params: ICreateFunctionIncludeParams,
  lockHandle: string,
  logger?: ILogger,
): Promise<void> {
  if (!params.function_group_name) {
    throw new Error('function_group_name is required');
  }
  if (!params.include_name) {
    throw new Error('include_name is required');
  }
  if (!lockHandle) {
    throw new Error('lockHandle is required for update');
  }

  const groupLower = encodeSapObjectName(
    params.function_group_name,
  ).toLowerCase();
  const encodedInclude = encodeSapObjectName(params.include_name.toUpperCase());
  const corrNr = params.transport_request
    ? `&corrNr=${encodeURIComponent(params.transport_request)}`
    : '';
  const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}?lockHandle=${encodeURIComponent(lockHandle)}${corrNr}`;

  const xmlBody = buildFunctionIncludeXml(params);

  if (debugEnabled) {
    logger?.debug?.('[UPDATE XML]');
    logger?.debug?.(xmlBody);
  }

  await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept: ACCEPT_FUNCTION_INCLUDE,
      'Content-Type': CT_FUNCTION_INCLUDE,
    },
  });
}
