import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { FEATURE_TOGGLE } from '../../endpoints/objects';

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
 * `<CHECK_RESULT>X</CHECK_RESULT>`. Measured 2026-08-31.
 *
 * It answers `application/vnd.sap.as+xml` (the `ACCEPT_VALIDATION` every other
 * name validation sends) and nothing else: the toggle's own
 * `application/vnd.sap.adt.blues.v1+xml`, sent until 36.0.1, is refused `406`
 * "Accepted content types: application/vnd.sap.as+xml". Measured on an
 * on-premise system, 2026-10-19. `validate` is `IAdtValidatable`'s, which takes
 * no `options.headers`, so the type stays here, as in every other validation.
 */
export async function validateFeatureToggleName(
  connection: IAbapConnection,
  name: string,
  packageName?: string,
  description?: string,
): Promise<IAdtWireResponse> {
  const params: Record<string, string> = { objname: name.toUpperCase() };
  if (packageName) params.packagename = packageName.toUpperCase();
  if (description) params.description = description;

  return connection.makeAdtRequest({
    method: 'POST',
    url: FEATURE_TOGGLE.validation,
    timeout: 0,
    headers: { Accept: ACCEPT_VALIDATION },
    params,
  });
}
