/**
 * Admin: what the legacy 7.40 test environment holds — the open marked
 * request, package ZLG7_TEST, every object in scope. Reads only (runs
 * ZCL_LG7_ENV_STATUS through ABAP Unit). Report: .legacy-env/status.json
 *
 * With `legacy_env.runner: manual` it skips: the owner runs
 * ZCL_LG7_ENV_RUN=>STATUS in SE24 instead.
 *
 * Run: as legacy:setup, with npm run legacy:status
 */

import { MANUAL_RUNNER, status } from '../../helpers/legacyEnv';
import { legacyEnvAdmin } from './adminRun';

legacyEnvAdmin('status', (runner) =>
  runner === 'manual'
    ? {
        skip: `legacy_env.runner is manual — run ${MANUAL_RUNNER}=>STATUS in SE24`,
      }
    : {
        title: 'status the environment',
        run: (session, logger) => status({ ...session, logger }),
      },
);
