/**
 * FunctionInclude (FUGR/I) metadata update operations.
 *
 * Requires a valid lockHandle (acquired via lockFunctionInclude).
 * Body is identical to create; only the URL differs (PUT to single-object URL
 * with ?lockHandle=...).
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_FUNCTION_INCLUDE,
  CT_FUNCTION_INCLUDE,
} from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateFunctionIncludeParams } from './types';
import { buildFunctionIncludeXml } from './xmlBuilder';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';

/**
 * Update function include metadata via PUT.
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateFunctionInclude(
  connection: IAbapConnection,
  params: ICreateFunctionIncludeParams,
  lockHandle?: string,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const groupLower = encodeSapObjectName(
    params.function_group_name,
  ).toLowerCase();
  const encodedInclude = encodeSapObjectName(params.include_name.toUpperCase());
  const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}${writeQuery(lockHandle, params.transport_request)}`;

  const xmlBody = buildFunctionIncludeXml(params);

  if (debugEnabled) {
    logger?.debug?.('[UPDATE XML]');
    logger?.debug?.(xmlBody);
  }

  // The answer is returned rather than discarded: what a write becomes is the
  // consumer's result strategy to decide, and a function that swallowed it left
  // that strategy nothing to read.
  return connection.makeAdtRequest({
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
