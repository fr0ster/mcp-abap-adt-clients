import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_METADATA } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate a feature toggle name, package and description before creating it.
 *
 * This used to `GET /sap/bc/adt/sfw/featuretoggles` — the collection — and throw
 * away the three arguments it was handed. That endpoint answers
 * `400 "URI-Mapping cannot be performed due to invalid URI"` to a GET, so the
 * call could not succeed and validated nothing; the suite that would have caught
 * it was skipping for an unrelated reason.
 *
 * `POST /sap/bc/adt/sfw/featuretoggles/validation` is the resource discovery
 * advertises for this — a GET on it answers 405, a POST with the usual
 * `objname`/`packagename`/`description` query answers 200 with
 * `<CHECK_RESULT>X</CHECK_RESULT>`. Measured on E19 2026-08-31.
 */
export async function validateFeatureToggleName(
  connection: IAbapConnection,
  name: string,
  packageName?: string,
  description?: string,
): Promise<IAdtWireResponse> {
  if (!name) {
    throw new Error('Feature toggle name is required');
  }
  const params: Record<string, string> = { objname: name.toUpperCase() };
  if (packageName) params.packagename = packageName.toUpperCase();
  if (description) params.description = description;

  return connection.makeAdtRequest({
    method: 'POST',
    url: '/sap/bc/adt/sfw/featuretoggles/validation',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_METADATA },
    params,
  });
}
