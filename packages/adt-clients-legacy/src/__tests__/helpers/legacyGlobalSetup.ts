/**
 * The root harness's globalSetup, with the legacy test configuration
 * registered first: globalSetup runs outside the test files' module
 * registry, so `legacySetup.ts` does not reach it, and the preflight reads
 * the configuration (the connection type, the system) before any file runs.
 */
import './legacyTestConfig';
import globalSetup from '../../../../adt-clients/src/__tests__/helpers/globalSetup';

export default globalSetup;
