/**
 * Admin: prepare the legacy 7.40 test environment — install the env classes,
 * run ZCL_LG7_ENV_PREPARE through ABAP Unit (own locks, leftovers, inactive
 * versions, the marked request, package ZLG7_TEST), delete the DDL sources it
 * left for ADT, create or refresh the fixtures. Report: .legacy-env/setup.json
 *
 * Run (the 7.40 configuration and its .env, RFC):
 *   MCP_TEST_CONFIG_PATH=src/__tests__/helpers/test-config.legacy-740.yaml \
 *   MCP_ENV_PATH=<the 7.40 .env> SAPNWRFC_HOME=… npm run legacy:setup
 */

import { configuredSettings, setup } from '../../helpers/legacyEnv';
import { legacyEnvAdmin } from './adminRun';

legacyEnvAdmin('setup', (session, logger) =>
  setup({ ...session, logger }, configuredSettings()),
);
