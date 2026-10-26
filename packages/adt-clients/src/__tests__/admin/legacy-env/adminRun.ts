/**
 * What the legacy-env admin runs share: a legacy session over RFC on a
 * system that is legacy (a modern one is refused before anything runs), the
 * env action, and its report in `.legacy-env/<action>.json` (gitignored — it
 * names the request the system gave) and through the tests logger.
 *
 * Which step runs depends on `legacy_env.runner`: each admin run states its
 * step per runner — a title naming the owner's manual step around it, or a
 * skip saying what to run in SE24 instead.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  assertLegacySystem,
  configuredRunner,
  describeRun,
  type EnvHandOff,
  type EnvRun,
  type EnvRunner,
} from '../../helpers/legacyEnv';
import {
  closeLegacySession,
  type LegacySession,
  openLegacySession,
} from '../../helpers/legacyLive';
import { describeLegacyRfc } from '../../helpers/legacyRfc';
import { createTestsLogger } from '../../helpers/testLogger';

const REPORT_DIR = path.resolve(__dirname, '../../../../.legacy-env');

export type AdminRun = (
  session: LegacySession,
  logger: ReturnType<typeof createTestsLogger>,
) => Promise<EnvRun | EnvHandOff>;

/** One admin step under a runner: what it does, or why it does not run. */
export type AdminStep =
  | { readonly title: string; readonly run: AdminRun }
  | { readonly skip: string };

export function legacyEnvAdmin(
  action: string,
  stepFor: (runner: EnvRunner) => AdminStep,
): void {
  describeLegacyRfc(`Admin: legacy 7.40 test environment — ${action}`, () => {
    const step = stepFor(configuredRunner());
    if ('skip' in step) {
      it.skip(`skipped: ${step.skip}`, () => {});
      return;
    }
    let session: LegacySession | undefined;
    const logger = createTestsLogger();

    beforeAll(async () => {
      session = await openLegacySession();
      // Before anything is installed: a modern system is refused.
      await assertLegacySystem(session.connection);
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    it(step.title, async () => {
      const result = await step.run(session as LegacySession, logger);
      fs.mkdirSync(REPORT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(REPORT_DIR, `${action}.json`),
        `${JSON.stringify(result, null, 2)}\n`,
      );
      if ('handOff' in result) {
        logger.info(
          [...result.done, ...result.next.map((l) => `next: ${l}`)].join('\n'),
        );
        return;
      }
      logger.info(describeRun(result));
      expect(result.result.ok).toBe(true);
    }, 3600000);
  });
}
