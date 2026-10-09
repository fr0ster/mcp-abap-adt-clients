/**
 * FunctionInclude (FUGR/I) create operations - Low-level functions
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_FUNCTION_INCLUDE,
  CT_FUNCTION_INCLUDE,
} from '../../constants/contentTypes';
import { FUNCTION_INCLUDE } from '../../endpoints/objects';
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
): Promise<IAdtWireResponse> {
  const url = `${FUNCTION_INCLUDE.collection(args.function_group_name)}${args.transport_request ? `?corrNr=${encodeURIComponent(args.transport_request)}` : ''}`;

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
