/**
 * Admin: remove the legacy 7.40 test environment — run ZCL_LG7_ENV_TEARDOWN
 * through ABAP Unit (own locks; every object in scope, fixtures included;
 * inactive versions; package ZLG7_TEST; every marked request of the user,
 * none released), delete the DDL sources it left for ADT, then delete the env
 * classes themselves over ADT. Report: .legacy-env/teardown.json
 *
 * Run: as legacy:setup, with npm run legacy:teardown
 */

import { teardown } from '../../helpers/legacyEnv';
import { legacyEnvAdmin } from './adminRun';

legacyEnvAdmin('teardown', (session, logger) =>
  teardown({ ...session, logger }),
);
