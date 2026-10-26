/**
 * Admin: remove the legacy 7.40 test environment.
 *
 * `legacy_env.runner: abap_unit`, in this order: ZCL_LG7_ENV_TEARDOWN through
 * ABAP Unit (own locks; every object in scope, fixtures included; inactive
 * versions), the DDL sources over ADT, ZCL_LG7_ENV_REMOVE (package ZLG7_TEST;
 * every marked request of the user, none released), then the env classes
 * themselves over ADT. A credential refusal stops it at once.
 *
 * `legacy_env.runner: manual` — after the owner's ZCL_LG7_ENV_RUN=>TEARDOWN in
 * SE24: the configured DDL sources over ADT, nothing else. Then the owner runs
 * ZCL_LG7_ENV_RUN=>REMOVE, then npm run legacy:uninstall.
 *
 * Report: .legacy-env/teardown.json
 *
 * Run: as legacy:setup, with npm run legacy:teardown
 */

import {
  configuredDdlNames,
  MANUAL_RUNNER,
  teardown,
  teardownManual,
} from '../../helpers/legacyEnv';
import { legacyEnvAdmin } from './adminRun';

legacyEnvAdmin('teardown', (runner) =>
  runner === 'manual'
    ? {
        title: `teardown (manual runner, after ${MANUAL_RUNNER}=>TEARDOWN): DDL sources — next: ${MANUAL_RUNNER}=>REMOVE in SE24, then npm run legacy:uninstall`,
        run: (session, logger) =>
          teardownManual({ ...session, logger }, configuredDdlNames()),
      }
    : {
        title: 'teardown the environment',
        run: (session, logger) => teardown({ ...session, logger }),
      },
);
