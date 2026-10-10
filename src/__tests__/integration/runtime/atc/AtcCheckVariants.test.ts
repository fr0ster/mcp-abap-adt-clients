/**
 * Integration test for listing ATC check variants (AdtAtc.listCheckVariants).
 *
 * Read-only: one GET per case against `/atc/variants`. What it holds the
 * system to is what was measured (SAP_BASIS 758 and 816, SAP BTP ABAP
 * Environment, 2026-10-06/10): `*` lists every variant, the match ignores case,
 * a name without `*` matches exactly, and a limit returns fewer. The limit is
 * not asserted exactly — on the cloud a limit of 3 answered 6.
 *
 * Run: npm test -- src/__tests__/integration/runtime/atc/AtcCheckVariants.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { atcSystemCheckVariant } from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { AdtAtc, atcDocuments } from '../../../../runtime/atc/AdtAtc';
import { expectResult } from '../../../helpers/contract';
import {
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import { logTestSkip, logTestStep } from '../../../helpers/testProgressLogger';

const { getEnabledTestCase } = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

const testCase = getEnabledTestCase('atc_run', 'adt_atc_check_variants');

/** The names in a `nameditem:namedItemList`, and the count it states. */
function namesOf(document: string): { names: string[]; total: number } {
  return {
    names: [...document.matchAll(/<nameditem:name>([^<]*)</g)].map((m) => m[1]),
    total: Number(/totalItemCount>(\d+)</.exec(document)?.[1] ?? NaN),
  };
}

describe('ATC check variants (AdtAtc.listCheckVariants)', () => {
  let connection: IAbapConnection | undefined;
  let atc: AdtAtc<
    typeof atcDocuments & { checkVariant: typeof atcSystemCheckVariant }
  >;
  let skipReason: string | undefined;
  let all: string[] = [];

  beforeAll(async () => {
    if (!testCase) {
      skipReason = 'atc_run.adt_atc_check_variants is not enabled';
      return;
    }
    try {
      connection = await createTestConnection(connectionLogger);
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
      skipReason = 'no SAP configuration';
      return;
    }
    atc = new AdtAtc(connection, libraryLogger, {
      ...atcDocuments,
      checkVariant: atcSystemCheckVariant,
    });
  });

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  const skipped = (): boolean => {
    if (skipReason) logTestSkip(testsLogger, 'ATC check variants', skipReason);
    return Boolean(skipReason);
  };

  it('lists every variant for *, the stated count being the count returned', async () => {
    if (skipped()) return;
    const { names, total } = namesOf(
      String(expectResult(await atc.listCheckVariants('*'), 'variants')),
    );
    logTestStep(`${names.length} check variants`, testsLogger);
    expect(names.length).toBeGreaterThan(0);
    expect(total).toBe(names.length);
    all = names;
  });

  it('finds the system variant by its name, in any case, and not by a prefix', async () => {
    if (skipped()) return;
    const system = expectResult(await atc.resolveCheckVariant(), 'variant');
    if (!system) {
      logTestSkip(testsLogger, 'ATC check variants', 'no system check variant');
      return;
    }
    const exact = namesOf(
      String(expectResult(await atc.listCheckVariants(system), 'exact')),
    ).names;
    expect(exact).toEqual([system]);

    const lower = namesOf(
      String(
        expectResult(
          await atc.listCheckVariants(system.toLowerCase()),
          'lower case',
        ),
      ),
    ).names;
    expect(lower).toEqual([system]);

    const prefix = system.slice(0, 3);
    const byPrefix = namesOf(
      String(expectResult(await atc.listCheckVariants(prefix), 'prefix')),
    ).names;
    expect(byPrefix).not.toContain(system);
  });

  it('returns fewer with a limit', async () => {
    if (skipped()) return;
    if (all.length < 10) return;
    const limited = namesOf(
      String(
        expectResult(
          await atc.listCheckVariants('*', { maxItemCount: 3 }),
          'limited',
        ),
      ),
    ).names;
    logTestStep(`a limit of 3 returned ${limited.length}`, testsLogger);
    expect(limited.length).toBeGreaterThan(0);
    expect(limited.length).toBeLessThan(all.length);
  });
});
