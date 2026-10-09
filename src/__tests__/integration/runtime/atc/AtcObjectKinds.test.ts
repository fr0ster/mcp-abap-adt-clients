/**
 * ATC over programs and every kind of include (interfaces-adt 12.0.0).
 *
 * What was measured on an on-premise and a cloud system, and what this file
 * keeps true: ATC checks an include as the object that owns it — a program
 * include lists its main program in the worklist, a function include its
 * function group, a class include its class — and each kind is found only at
 * its own address. So the assertion is on the worklist naming the owner, not
 * on a run being accepted: a URI that cannot exist is answered 201 too.
 *
 * Which references to run is the system's: a cloud system holds no program
 * and no program include, so each system's test-config lists its own. The
 * owner must have findings under the check variant, or the worklist lists
 * nothing — `check_variant` pins one where the nominated variant does not run.
 *
 * A reference marked `findings_outside` also asserts that the run reported a
 * finding outside the include sent: the check covers the owner, not only the
 * include named. Mark it only where such a finding is known to exist.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  atcSystemCheckVariant,
  atcWaitingRun,
  atcWorklistId,
} from '@mcp-abap-adt/adt-strategies';
import type { IAtcObjectRef } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import * as dotenv from 'dotenv';
import { AdtAtc, atcDocuments } from '../../../../runtime/atc/AdtAtc';
import { buildAtcObjectUri } from '../../../../runtime/atc/run';
import { findingsOutside } from '../../../helpers/atcFindings';
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
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getEnabledTestCase,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger = createConnectionLogger();
const libraryLogger = createLibraryLogger();
const testsLogger = createTestsLogger();

const SECTION = 'atc_object_kinds';
const CASE = 'adt_atc_object_kinds';
// Each reference is one waited run; a few of them in one case.
const JEST_TIMEOUT = Math.max(getTimeout('test'), 600_000);

const atcReading = {
  ...atcDocuments,
  checkVariant: atcSystemCheckVariant,
  worklist: atcWorklistId,
  waitingRun: atcWaitingRun,
};

/** One configured reference and the owner ATC is to list for it. */
interface IKindCase {
  ref: IAtcObjectRef;
  ownerType: string;
  ownerName: string;
  findingsOutside: boolean;
}

function kindCases(params: Record<string, unknown>): IKindCase[] {
  const raw = (params.refs ?? []) as Array<Record<string, string | boolean>>;
  return raw.map((r) => ({
    ref: {
      objectType: String(r.object_type),
      objectName: String(r.object_name),
      ...(r.function_group ? { functionGroup: r.function_group } : {}),
      ...(r.include_kind ? { includeKind: r.include_kind } : {}),
    } as IAtcObjectRef,
    ownerType: String(r.owner_type).toUpperCase(),
    ownerName: String(r.owner_name).toUpperCase(),
    findingsOutside: r.findings_outside === true,
  }));
}

/** The `type name` pairs a worklist lists. */
function listedObjects(worklist: string): string[] {
  return [...worklist.matchAll(/<atcobject:object [^>]*/g)].map((m) => {
    const type = /adtcore:type="([^"]*)"/.exec(m[0])?.[1] ?? '';
    const name = /adtcore:name="([^"]*)"/.exec(m[0])?.[1] ?? '';
    return `${type} ${name}`;
  });
}

describe('ATC over programs and every kind of include', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      hasConfig = true;
    } catch (error) {
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  it(
    'lists the owner of each configured reference in the finished worklist',
    async () => {
      const testName = 'AtcObjectKinds - owner listed';
      const testCase = getEnabledTestCase(SECTION, CASE);
      logTestStart(testsLogger, testName, {
        name: CASE,
        params: testCase?.params || {},
      });
      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          `${SECTION}/${CASE} not configured or disabled in test-config.yaml`,
        );
        return;
      }
      if (!hasConfig) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      const cases = kindCases(testCase.params);
      if (cases.length === 0) {
        throw new Error(`${SECTION}/${CASE}: params.refs lists no reference`);
      }

      try {
        const atc = new AdtAtc(connection, libraryLogger, atcReading);
        const pinned = String(testCase.params.check_variant ?? '').trim();
        const variant =
          pinned ||
          expectResult(await atc.resolveCheckVariant(), 'check variant');

        for (const c of cases) {
          logTestStep(
            `${c.ref.objectType} ${c.ref.objectName} → expect ${c.ownerType} ${c.ownerName}`,
            testsLogger,
          );
          const worklistId = expectResult(
            await atc.createWorklist(variant),
            'worklist',
          );
          const run = expectResult(
            await atc.startRun(
              worklistId,
              { objects: [c.ref] },
              { wait: true },
            ),
            'ATC run',
          );
          expect(run.waited).toBe(true);
          const worklist = String(
            expectResult(await atc.getFindings(worklistId), 'worklist read'),
          );
          expect(listedObjects(worklist)).toContain(
            `${c.ownerType} ${c.ownerName}`,
          );
          if (c.findingsOutside) {
            const outside = findingsOutside(worklist, buildAtcObjectUri(c.ref));
            expect(outside.length).toBeGreaterThan(0);
          }
        }
        logTestSuccess(testsLogger, testName);
      } catch (error) {
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    JEST_TIMEOUT,
  );
});
