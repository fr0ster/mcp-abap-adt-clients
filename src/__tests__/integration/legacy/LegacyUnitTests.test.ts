/**
 * The legacy ABAP Unit runners on SAP_BASIS 7.40 SP04 over RFC (spec §6, §11.2).
 *
 * Measured: `POST /sap/bc/adt/abapunit/testruns` with `<options>` answers the
 * finished result — the methods that ran — for a class, a report, a function
 * group, and a function module (whose URI runs its group's tests). Every legacy
 * runner sends that one request: class, program and group `run` and `runSync`,
 * and the module's `runSync`. Each is asserted here on the recorder — one POST
 * to `testruns`, `<options>` in its body, answered `200` — and on the answer:
 * at least one `testMethod`.
 *
 * Nothing is created: the case names existing objects that hold tests. Runs on
 * a legacy configuration over RFC with case `legacy_740/legacy_unit_runners`
 * enabled: npm run test:detached -- integration/legacy/LegacyUnitTests
 */

import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { expectResult } from '../../helpers/contract';
import {
  type CaseParams,
  closeLegacySession,
  type LegacySession,
  lineOf,
  openLegacySession,
  param,
  sentSince,
  withLegacyCase,
} from '../../helpers/legacyLive';
import { describeLegacyRfc } from '../../helpers/legacyRfc';

const TESTRUNS = 'POST /sap/bc/adt/abapunit/testruns';

/** The names of the methods a result document reports. */
function methodsOf(document: string): string[] {
  return [
    ...document.matchAll(/<testMethod\b[^>]*\badtcore:name="([^"]+)"/g),
  ].map((m) => m[1]);
}

interface RunCase {
  readonly title: string;
  readonly run: (session: LegacySession) => Promise<IAdtResponse<unknown>>;
}

function runCases(params: CaseParams): RunCase[] {
  const className = () => param(params, 'class_name');
  const programName = () => param(params, 'program_name');
  const groupName = () => param(params, 'function_group_name');
  const moduleName = () => param(params, 'function_module_name');
  return [
    {
      title: 'class run',
      run: (s) => s.executor.getClassTestRunner().run(className()),
    },
    {
      title: 'class runSync',
      run: (s) => s.executor.getClassTestRunner().runSync(className()),
    },
    {
      title: 'program run',
      run: (s) => s.executor.getProgramTestRunner().run(programName()),
    },
    {
      title: 'program runSync',
      run: (s) => s.executor.getProgramTestRunner().runSync(programName()),
    },
    {
      title: 'function group run',
      run: (s) => s.executor.getFunctionGroupTestRunner().run(groupName()),
    },
    {
      title: 'function group runSync',
      run: (s) => s.executor.getFunctionGroupTestRunner().runSync(groupName()),
    },
    {
      title: 'function module runSync',
      run: (s) =>
        s.executor.getFunctionModuleTestRunner().runSync({
          functionGroupName: groupName(),
          functionModuleName: moduleName(),
        }),
    },
  ];
}

describeLegacyRfc('Legacy 7.40 SP04 over RFC — ABAP Unit runners', () => {
  withLegacyCase('legacy_unit_runners', (params) => {
    let session: LegacySession | undefined;
    const current = () => session as LegacySession;

    beforeAll(async () => {
      session = await openLegacySession();
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    for (const { title, run } of runCases(params)) {
      it(`${title} sends one testruns POST with <options> and answers the methods`, async () => {
        const { recorder } = current();
        const mark = recorder.requests.length;

        const document = String(expectResult(await run(current()), title));

        const sent = sentSince(recorder, mark);
        expect(sent.map(lineOf)).toEqual([TESTRUNS]);
        expect(String(sent[0]?.data ?? '')).toContain('<options>');
        expect(sent[0]?.status).toBe(200);
        expect(methodsOf(document).length).toBeGreaterThan(0);
      }, 300000);
    }
  });
});
