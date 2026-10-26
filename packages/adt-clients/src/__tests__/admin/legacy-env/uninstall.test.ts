/**
 * Admin: delete the env classes of the legacy 7.40 test environment over ADT —
 * ZCL_LG7_ENV, its runners and ZCL_LG7_ENV_RUN, each that is there, in $TMP
 * and of the session user. Nothing else is touched.
 *
 * The last step with `legacy_env.runner: manual`, after the owner's
 * ZCL_LG7_ENV_RUN=>REMOVE in SE24 (`legacy:teardown` deletes the classes
 * itself with `abap_unit`). Report: .legacy-env/uninstall.json
 *
 * Run: as legacy:setup, with npm run legacy:uninstall
 */

import { MANUAL_RUNNER, uninstall } from '../../helpers/legacyEnv';
import { legacyEnvAdmin } from './adminRun';

legacyEnvAdmin('uninstall', (runner) => ({
  title:
    runner === 'manual'
      ? `uninstall the env classes (after ${MANUAL_RUNNER}=>REMOVE in SE24)`
      : 'uninstall the env classes',
  run: (session, logger) => uninstall({ ...session, logger }),
}));
