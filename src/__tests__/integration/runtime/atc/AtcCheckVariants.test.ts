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
import {
  analyseException,
  atcSystemCheckVariant,
} from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { AdtAtc, atcDocuments } from '../../../../runtime/atc/AdtAtc';
import { gate } from '../../../helpers/caseGate';
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
import { logTestStep } from '../../../helpers/testProgressLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

// Disabled in test-config.yaml, or no SAP: registered as skipped.
const variantsCase = gate('atc_run', 'adt_atc_check_variants');

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
  let all: string[] = [];

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
      throw error;
    }
    atc = new AdtAtc(connection, libraryLogger, {
      ...atcDocuments,
      checkVariant: atcSystemCheckVariant,
    });
  });

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  variantsCase(
    'lists every variant for *, the stated count being the count returned',
    async () => {
      const { names, total } = namesOf(
        String(
          expectResult(
            await atc.listCheckVariants('*', { analyse: analyseException }),
            'variants',
          ),
        ),
      );
      logTestStep(`${names.length} check variants`, testsLogger);
      expect(names.length).toBeGreaterThan(0);
      expect(total).toBe(names.length);
      all = names;
    },
  );

  variantsCase(
    'finds the system variant by its name, in any case, and not by a prefix',
    async () => {
      const system = expectResult(
        await atc.resolveCheckVariant({ analyse: analyseException }),
        'variant',
      );
      if (!system) {
        throw new Error('the system names no default check variant');
      }
      const exact = namesOf(
        String(
          expectResult(
            await atc.listCheckVariants(system, { analyse: analyseException }),
            'exact',
          ),
        ),
      ).names;
      expect(exact).toEqual([system]);

      const lower = namesOf(
        String(
          expectResult(
            await atc.listCheckVariants(system.toLowerCase(), {
              analyse: analyseException,
            }),
            'lower case',
          ),
        ),
      ).names;
      expect(lower).toEqual([system]);

      const prefix = system.slice(0, 3);
      const byPrefix = namesOf(
        String(
          expectResult(
            await atc.listCheckVariants(prefix, { analyse: analyseException }),
            'prefix',
          ),
        ),
      ).names;
      expect(byPrefix).not.toContain(system);
    },
  );

  variantsCase('returns fewer with a limit', async () => {
    // A limit of 3 can only be seen to cut a list longer than 3.
    expect(all.length).toBeGreaterThan(3);
    const limited = namesOf(
      String(
        expectResult(
          await atc.listCheckVariants('*', {
            analyse: analyseException,
            maxItemCount: 3,
          }),
          'limited',
        ),
      ),
    ).names;
    logTestStep(`a limit of 3 returned ${limited.length}`, testsLogger);
    expect(limited.length).toBeGreaterThan(0);
    expect(limited.length).toBeLessThan(all.length);
  });
});
