/**
 * FunctionGroup update operations
 *
 * Note: Function groups are containers for function modules.
 * They don't have source code to update directly, but metadata can be updated.
 */

import type {
  HttpError,
  IAbapConnection,
  IAdtContentTypes,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { CT_FUNCTION_GROUP } from '../../constants/contentTypes';
import {
  encodeSapObjectName,
  limitDescription,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { extractXmlString, patchXmlAttribute } from '../../utils/xmlPatch';
import { lockFunctionGroup } from './lock';
import { getFunctionGroup } from './read';
import type { IUpdateFunctionGroupParams } from './types';
import { unlockFunctionGroup } from './unlock';

/**
 * Write the document the caller built.
 *
 * **One request.** This used to lock the group, GET its document, patch the
 * description into it, PUT the result and unlock — four requests in one member,
 * with the lock window and the merge both decided here. A caller now locks,
 * reads, edits, writes and unlocks, in the order they choose, over members that
 * each issue one request.
 *
 * A field left out of `document` is not preserved: nothing was read to preserve
 * it from.
 */
export async function updateFunctionGroup(
  connection: IAbapConnection,
  params: IUpdateFunctionGroupParams,
  document: string,
  contentTypes?: IAdtContentTypes,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(params.function_group_name);
  const lockHandle = params.lock_handle;
  const url = `/sap/bc/adt/functions/groups/${encodedName}${lockHandle ? `?lockHandle=${encodeURIComponent(lockHandle)}` : ''}${params.transport_request ? `${lockHandle ? '&' : '?'}corrNr=${params.transport_request}` : ''}`;

  const ct = contentTypes?.functionGroupUpdate();

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: {
      'Content-Type':
        ct?.contentType ||
        'application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8',
      Accept: ct?.accept || CT_FUNCTION_GROUP,
    },
  });
}
