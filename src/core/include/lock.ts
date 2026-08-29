/**
 * Include lock — the include itself is the lock target.
 *
 * Not the main program it is included in: the captured exchange locks
 * `/programs/includes/{name}`, and the source is written under that handle.
 * This is the opposite of class includes, where the CLASS is what gets locked.
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

function includeUrl(includeName: string): string {
  return `/sap/bc/adt/programs/includes/${encodeSapObjectName(includeName).toLowerCase()}`;
}

export async function lockInclude(
  connection: IAbapConnection,
  includeName: string,
): Promise<{ response: IAdtResponse; lockHandle: string; corrNr?: string }> {
  const response = await connection.makeAdtRequest({
    url: `${includeUrl(includeName)}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const parsed = parser.parse(response.data);
  const values = parsed?.['asx:abap']?.['asx:values']?.DATA;
  const lockHandle = values?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error(
      `Failed to obtain a lock handle for include ${includeName}. It may be locked by another user.`,
    );
  }

  return { response, lockHandle, corrNr: values?.CORRNR };
}

export { includeUrl };
