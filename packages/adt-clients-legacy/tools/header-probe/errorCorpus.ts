/**
 * The root package's error corpus (`tools/header-probe/errorCorpus.ts`
 * there: preparation, flags and output are that file's), with the legacy
 * clients probed beside the modern ones (`legacyClients.ts`).
 *
 * Run (from packages/adt-clients-legacy):
 *   npm run header:discovery -- --from clients --headers corpus
 */

import { runAndExit } from '../../../adt-clients/tools/header-probe/errorCorpus';
// Registers the legacy sections and overlay keys with the root's loader, so
// the overlay `test:live` reads (`MCP_TEST_OVERLAY`) serves this run as well.
import '../../src/__tests__/helpers/legacyTestConfig';
import { registerLegacyClients } from './legacyClients';

registerLegacyClients();
runAndExit();
