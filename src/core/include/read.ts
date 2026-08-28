/**
 * Include read.
 *
 * Metadata comes back as `include:abapInclude`; source is the usual
 * `source/main`. Note that a source read answers `200` with an EMPTY body when
 * the object exists but has no active version — it never 404s — so absence is
 * told by content, not by status.
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { CT_INCLUDE } from './create';
import { includeUrl } from './lock';

export async function getIncludeMetadata(
  connection: IAbapConnection,
  includeName: string,
): Promise<IAdtResponse> {
  return connection.makeAdtRequest({
    url: includeUrl(includeName),
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: CT_INCLUDE },
  });
}

export async function getIncludeSource(
  connection: IAbapConnection,
  includeName: string,
  version?: 'active' | 'inactive',
): Promise<IAdtResponse> {
  const query = version ? `?version=${version}` : '';
  return connection.makeAdtRequest({
    url: `${includeUrl(includeName)}/source/main${query}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: 'text/plain' },
  });
}
