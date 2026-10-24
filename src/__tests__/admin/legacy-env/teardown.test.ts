/**
 * Admin: remove the legacy 7.40 test environment, in this order:
 * ZCL_LG7_ENV_TEARDOWN through ABAP Unit (own locks; every object in scope,
 * fixtures included; inactive versions), the DDL sources over ADT,
 * ZCL_LG7_ENV_REMOVE (package ZLG7_TEST; every marked request of the user,
 * none released), then the env classes themselves over ADT. A credential
 * refusal stops it at once. Report: .legacy-env/teardown.json
 *
 * Run: as legacy:setup, with npm run legacy:teardown
 */

import { teardown } from '../../helpers/legacyEnv';
import { legacyEnvAdmin } from './adminRun';

legacyEnvAdmin('teardown', (session, logger) =>
  teardown({ ...session, logger }),
);
