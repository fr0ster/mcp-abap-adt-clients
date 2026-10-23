/**
 * What the three legacy-env admin runs share: a legacy session over RFC, the
 * env action, and its report in `.legacy-env/<action>.json` (gitignored — it
 * names the request the system gave) and through the tests logger.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describeRun, type EnvRun } from '../../helpers/legacyEnv';
import {
  closeLegacySession,
  type LegacySession,
  openLegacySession,
} from '../../helpers/legacyLive';
import { describeLegacyRfc } from '../../helpers/legacyRfc';
import { createTestsLogger } from '../../helpers/testLogger';

const REPORT_DIR = path.resolve(__dirname, '../../../../.legacy-env');

export function legacyEnvAdmin(
  action: string,
  run: (
    session: LegacySession,
    logger: ReturnType<typeof createTestsLogger>,
  ) => Promise<EnvRun>,
): void {
  describeLegacyRfc(`Admin: legacy 7.40 test environment — ${action}`, () => {
    let session: LegacySession | undefined;
    const logger = createTestsLogger();

    beforeAll(async () => {
      session = await openLegacySession();
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    it(`${action} the environment`, async () => {
      const result = await run(session as LegacySession, logger);
      fs.mkdirSync(REPORT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(REPORT_DIR, `${action}.json`),
        `${JSON.stringify(result, null, 2)}\n`,
      );
      logger.info(describeRun(result));
      expect(result.result.ok).toBe(true);
    }, 3600000);
  });
}
