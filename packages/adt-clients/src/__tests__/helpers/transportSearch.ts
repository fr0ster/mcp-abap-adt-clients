/**
 * Whether the account holds a saved transport search configuration — the
 * system's `environment.transport_search_configured`, required and boolean:
 * no default and no environment variable, read at the call.
 *
 * A transport listing runs a saved search the caller names. A fresh ABAP
 * Cloud account holds none, so there is nothing to list through; the
 * configuration states that, and the case is registered as skipped saying so.
 * Where it states `true`, an empty list of configurations fails.
 */
import { requiredEnvironmentFlag } from './sessionConfig';

export const TRANSPORT_SEARCH_KEY = 'environment.transport_search_configured';

export function transportSearchConfigured(): boolean {
  return requiredEnvironmentFlag('transport_search_configured');
}

/**
 * The value for a title chosen at registration, `undefined` when the
 * configuration cannot say; the gate then reads it again and fails the case.
 */
export function transportSearchStated(): boolean | undefined {
  try {
    return transportSearchConfigured();
  } catch {
    return undefined;
  }
}
