/**
 * Admin: what the legacy 7.40 test environment holds — the open marked
 * request, package ZLG7_TEST, every object in scope. Reads only (runs
 * ZCL_LG7_ENV_STATUS through ABAP Unit). Report: .legacy-env/status.json
 *
 * Run: as legacy:setup, with npm run legacy:status
 */

import { status } from '../../helpers/legacyEnv';
import { legacyEnvAdmin } from './adminRun';

legacyEnvAdmin('status', (session, logger) => status({ ...session, logger }));
