import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateTransformationParams } from './types';

/**
 * Update transformation source code
 * Requires object to be locked first (lockHandle must be provided)
 */
export async function updateTransformation(
  connection: IAbapConnection,
  args: IUpdateTransformationParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const transformationNameEncoded = encodeSapObjectName(
    args.transformation_name.toLowerCase(),
  );

  const url = `/sap/bc/adt/xslt/transformations/${transformationNameEncoded}/source/main${writeQuery(lockHandle, args.transport_request)}`;

  const headers: Record<string, string> = {
    Accept: ACCEPT_SOURCE,
    'Content-Type': CT_SOURCE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers,
  });
}
