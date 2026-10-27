/**
 * The Jest setup of every suite in this package (`setupFiles` of both
 * configs): what the legacy classes bring to the root harness, before any
 * test file loads.
 *
 * - `legacyRegistrations` registers the header pairs and the refusals of the
 *   legacy classes. Without it `integrationHeadersOf` answers a legacy
 *   handler with the root class's pair — `AdtFunctionIncludeLegacy.create`
 *   would send the modern v2 pair 7.40 refuses — so no file may forget it,
 *   and none has to: it is loaded here, once per file.
 * - `legacyTestConfig` adds the legacy sections and overlay keys to the
 *   configuration every suite reads.
 */
import './legacyRegistrations';
import './legacyTestConfig';
