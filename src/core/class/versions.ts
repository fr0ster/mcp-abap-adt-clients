import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const ACCEPT_VERSION_FEED = 'application/atom+xml;type=feed';

/** Class source lives in includes, not a single source/main resource. */
export type ClassIncludeType =
  | 'main'
  | 'definitions'
  | 'implementations'
  | 'testclasses'
  | 'macros';

/**
 * The version history of one class include — the Atom feed, as it arrived.
 *
 * `objectVersions` in @mcp-abap-adt/adt-strategies reads it into entries. A
 * system without the resource answers 404 or 406, which comes back as the
 * transport's failure; until 23.0.0 it was thrown as a library error.
 */
export async function getClassIncludeVersions(
  connection: IAbapConnection,
  className: string,
  includeType: ClassIncludeType,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/oo/classes/${encodeSapObjectName(className)}/includes/${includeType}/versions`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VERSION_FEED },
  });
}

/** The source of one version, by the `contentUri` its entry carried. */
export async function getClassVersionSource(
  connection: IAbapConnection,
  contentUri: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: contentUri,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: 'text/plain' },
  });
}
