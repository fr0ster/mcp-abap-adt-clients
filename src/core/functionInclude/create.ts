/**
 * FunctionInclude (FUGR/I) create operations - Low-level functions
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_INCLUDE } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import type { ICreateFunctionIncludeParams } from './types';
import { buildFunctionIncludeXml } from './xmlBuilder';

/**
 * Low-level: Create function include (POST to the parent group's includes collection).
 * Does NOT upload source / activate — just creates the include metadata.
 */
export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateFunctionIncludeParams,
): Promise<IAdtWireResponse> {
  const url = `${FUNCTION_INCLUDE.collection(args.function_group_name)}${args.transport_request ? `?corrNr=${encodeURIComponent(args.transport_request)}` : ''}`;

  const xmlBody = buildFunctionIncludeXml(args);

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });
}
