/**
 * Admin: prepare the legacy 7.40 test environment.
 *
 * `legacy_env.runner: abap_unit` — install the env classes, run
 * ZCL_LG7_ENV_PREPARE through ABAP Unit (own locks, leftovers, inactive
 * versions, the marked request, package ZLG7_TEST), delete the DDL sources it
 * left for ADT, create or refresh the fixtures.
 *
 * `legacy_env.runner: manual` — install ZCL_LG7_ENV and ZCL_LG7_ENV_RUN, delete
 * the configured DDL sources a crashed run left, create or refresh the
 * fixtures; no ABAP Unit run. Then the owner runs ZCL_LG7_ENV_RUN=>PREPARE in
 * SE24 (the report's `next` lines say so, with the values).
 *
 * Report: .legacy-env/setup.json
 *
 * Run (the 7.40 system's overlay and its .env, RFC):
 *   MCP_TEST_OVERLAY=src/__tests__/helpers/test-config.overlay.<system>.yaml \
 *   MCP_ENV_PATH=<the 7.40 .env> SAPNWRFC_HOME=… npm run legacy:setup
 */

import {
  configuredDdlNames,
  configuredSettings,
  MANUAL_RUNNER,
  setup,
  setupManual,
} from '../../helpers/legacyEnv';
import { legacyEnvAdmin } from './adminRun';

legacyEnvAdmin('setup', (runner) =>
  runner === 'manual'
    ? {
        title: `setup (manual runner): env classes, DDL leftovers, fixtures — next: ${MANUAL_RUNNER}=>PREPARE in SE24`,
        run: (session, logger) =>
          setupManual(
            { ...session, logger },
            configuredSettings(),
            configuredDdlNames(),
          ),
      }
    : {
        title: 'setup the environment',
        run: (session, logger) =>
          setup({ ...session, logger }, configuredSettings()),
      },
);
