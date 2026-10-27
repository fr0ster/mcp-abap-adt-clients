/**
 * The root harness's globalTeardown, with the legacy test configuration
 * registered first, as `legacyGlobalSetup.ts` does for the setup.
 */
import './legacyTestConfig';
import globalTeardown from '../../../../adt-clients/src/__tests__/helpers/globalTeardown';

export default globalTeardown;
