import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock transformation
 * Must use same session and lock handle from lock operation
 */
export async function unlockTransformation(
  connection: IAbapConnection,
  transformationName: string,
  lockHandle: string,
): Promise<IAdtResponse> {
  const transformationNameEncoded = encodeSapObjectName(
    transformationName.toLowerCase(),
  );
  const url = `/sap/bc/adt/xslt/transformations/${transformationNameEncoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
