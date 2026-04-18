/**
 * FunctionInclude (FUGR/I) create operations - Low-level functions
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_FUNCTION_INCLUDE,
  CT_FUNCTION_INCLUDE,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateFunctionIncludeParams } from './types';
import { buildFunctionIncludeXml } from './xmlBuilder';

/**
 * Low-level: Create function include (POST to the parent group's includes collection).
 * Does NOT upload source / activate — just creates the include metadata.
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateFunctionIncludeParams,
): Promise<AxiosResponse> {
  if (!args.function_group_name) {
    throw new Error('function_group_name is required');
  }
  if (!args.include_name) {
    throw new Error('include_name is required');
  }

  const groupLower = encodeSapObjectName(
    args.function_group_name,
  ).toLowerCase();
  const url = `/sap/bc/adt/functions/groups/${groupLower}/includes${args.transport_request ? `?corrNr=${encodeURIComponent(args.transport_request)}` : ''}`;

  const xmlBody = buildFunctionIncludeXml(args);

  const headers = {
    Accept: ACCEPT_FUNCTION_INCLUDE,
    'Content-Type': CT_FUNCTION_INCLUDE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
