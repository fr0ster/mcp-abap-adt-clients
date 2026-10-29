/**
 * `runSync` on the report, function group and function module runners: one
 * POST to `/abapunit/testruns` naming the object by its URI, always with the
 * Eclipse-style `<options>` — without it the endpoint answered an empty result
 * for all three on premise (SAP_BASIS 816, 2026-10-23) — read by `result` and
 * judged by the caller's `analyse`.
 */

import { analyseUnitTest } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtExecutor } from '../../../clients/AdtExecutor';
import {
  abapUnitRunnerDocuments,
  type IAbapUnitRunnerResults,
} from '../../../executors/abapUnitRunner';
import { FunctionGroupTestRunner } from '../../../executors/functionGroup';
import { FunctionModuleTestRunner } from '../../../executors/functionModule';
import { ProgramTestRunner } from '../../../executors/program/ProgramTestRunner';
import { expectFailure, expectResult } from '../../helpers/contract';
import { createLibraryLogger } from '../../helpers/testLogger';

type Call = {
  url: string;
  method: string;
  data?: unknown;
  headers?: Record<string, string>;
};

/** What `/testruns` answered on premise for a report: one pass, one failure. */
const RUN_RESULT = `<?xml version="1.0" encoding="utf-8"?><aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit" xmlns:adtcore="http://www.sap.com/adt/core">
<program adtcore:uri="/sap/bc/adt/programs/programs/zr_report" adtcore:type="PROG/P" adtcore:name="ZR_REPORT"><testClasses><testClass adtcore:name="LTC_OWN"><testMethods>
<testMethod adtcore:name="PASSES"/>
<testMethod adtcore:name="FAILS"><alerts><alert kind="failedAssertion" severity="critical"><title>Critical Assertion Error: 'Assert Equals'</title></alert></alerts></testMethod>
</testMethods></testClass></testClasses></program></aunit:runResult>`;

/** The run configuration for one object URI with no options given, byte for byte. */
function bodyFor(uri: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="false"/>
  </external>
  <options>
    <uriType value="semantic"/>
    <testDeterminationStrategy sameProgram="true" assignedTests="false" appendAssignedTestsPreview="true"/>
    <testRiskLevels harmless="true" dangerous="true" critical="true"/>
    <testDurations short="true" medium="true" long="true"/>
    <withNavigationUri enabled="true"/>
  </options>
  <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
    <objectSet kind="inclusive">
      <adtcore:objectReferences>
        <adtcore:objectReference adtcore:uri="${uri}"/>
      </adtcore:objectReferences>
    </objectSet>
  </adtcore:objectSets>
</aunit:runConfiguration>`;
}

function makeConn() {
  const calls: Call[] = [];
  const conn = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    makeAdtRequest: async (call: Call) => {
      calls.push(call);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: RUN_RESULT,
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

/** Marks which strategy read the answer. */
const marked = {
  ...abapUnitRunnerDocuments,
  run: () => 'read by run',
  result: () => 'read by result',
};

/**
 * Each runner's `runSync`, bound to one target, so the three are tested by one
 * table. The URI is the one measured on premise for each type.
 */
const runners = [
  {
    label: 'ProgramTestRunner',
    runSync: (
      conn: IAbapConnection,
      results: IAbapUnitRunnerResults = marked,
      options?: object,
    ) =>
      new ProgramTestRunner(conn, {
        logger: createLibraryLogger(),
        results,
      }).runSync('ZR_REPORT', options),
    uri: '/sap/bc/adt/programs/programs/zr_report',
  },
  {
    label: 'FunctionGroupTestRunner',
    runSync: (
      conn: IAbapConnection,
      results: IAbapUnitRunnerResults = marked,
      options?: object,
    ) =>
      new FunctionGroupTestRunner(conn, {
        logger: createLibraryLogger(),
        results,
      }).runSync('Z_GROUP', options),
    uri: '/sap/bc/adt/functions/groups/z_group',
  },
  {
    label: 'FunctionModuleTestRunner',
    runSync: (
      conn: IAbapConnection,
      results: IAbapUnitRunnerResults = marked,
      options?: object,
    ) =>
      new FunctionModuleTestRunner(conn, {
        logger: createLibraryLogger(),
        results,
      }).runSync(
        { functionGroupName: 'Z_GROUP', functionModuleName: 'Z_MODULE' },
        options,
      ),
    uri: '/sap/bc/adt/functions/groups/z_group/fmodules/z_module',
  },
];

describe.each(runners)('$label.runSync', ({ runSync, uri }) => {
  it('one POST to /testruns, application/xml both ways, read by `result`', async () => {
    const { conn, calls } = makeConn();

    const answer = expectResult(await runSync(conn), 'runSync');

    expect(answer).toBe('read by result');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/testruns');
    expect(calls[0].headers).toEqual({
      'Content-Type': 'application/xml',
      Accept: 'application/xml',
    });
  });

  it('names the object by its URI, with <options> though none were given — byte for byte', async () => {
    const { conn, calls } = makeConn();

    await runSync(conn);

    expect(calls[0].data).toBe(bodyFor(uri));
  });

  it('scope, risk levels and durations are sent as given; title, context and analyse are not', async () => {
    const { conn, calls } = makeConn();

    await runSync(conn, marked, {
      title: 'not in this format',
      context: 'nor this',
      scope: { ownTests: false, foreignTests: true },
      riskLevel: { dangerous: false, critical: false },
      duration: { long: false },
      analyse: analyseUnitTest,
    });

    const body = String(calls[0].data);
    expect(body).toContain(
      '<testDeterminationStrategy sameProgram="false" assignedTests="true" appendAssignedTestsPreview="true"/>',
    );
    expect(body).toContain(
      '<testRiskLevels harmless="true" dangerous="false" critical="false"/>',
    );
    expect(body).toContain(
      '<testDurations short="true" medium="true" long="false"/>',
    );
    expect(body).not.toContain('not in this format');
    expect(body).not.toContain('nor this');
    expect(body).not.toContain('analyse');
  });

  it('a failing test is the caller’s analyse to judge, not the runner’s', async () => {
    const { conn } = makeConn();

    const asItCame = expectResult(
      await runSync(conn, abapUnitRunnerDocuments),
      'no analyse',
    );
    expect(String(asItCame)).toContain('FAILS');

    const judged = expectFailure(
      await runSync(conn, abapUnitRunnerDocuments, {
        analyse: analyseUnitTest,
      }),
      'analyseUnitTest',
    );
    expect(judged.message).toContain(
      "Critical Assertion Error: 'Assert Equals'",
    );
  });
});

describe('the asynchronous run stays the default, on /runs', () => {
  it('AdtExecutor hands out runners whose run and runSync are separate endpoints', async () => {
    const { conn, calls } = makeConn();
    const executor = new AdtExecutor(conn);

    await executor.getProgramTestRunner().run('ZR_REPORT');
    await executor.getProgramTestRunner().runSync('ZR_REPORT');
    await executor.getFunctionGroupTestRunner().run('Z_GROUP');
    await executor.getFunctionGroupTestRunner().runSync('Z_GROUP');
    await executor.getFunctionModuleTestRunner().run('Z_MODULE');
    await executor.getFunctionModuleTestRunner().runSync({
      functionGroupName: 'Z_GROUP',
      functionModuleName: 'Z_MODULE',
    });

    expect(calls.map((c) => c.url)).toEqual([
      '/sap/bc/adt/abapunit/runs',
      '/sap/bc/adt/abapunit/testruns',
      '/sap/bc/adt/abapunit/runs',
      '/sap/bc/adt/abapunit/testruns',
      '/sap/bc/adt/abapunit/runs',
      '/sap/bc/adt/abapunit/testruns',
    ]);
  });
});
