/**
 * Running a class's ABAP Unit tests: one request per member, and nothing that
 * manages the tests themselves — that is the local test class's.
 */

import { analyseUnitTest, unitTestRunId } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtExecutor } from '../../../clients/AdtExecutor';
import {
  ClassTestRunner,
  classTestRunnerDocuments,
} from '../../../executors/class/ClassTestRunner';
import { expectFailure, expectResult } from '../../helpers/contract';
import { createLibraryLogger } from '../../helpers/testLogger';

type Call = {
  url: string;
  method: string;
  data?: unknown;
  headers?: Record<string, string>;
};

/** What `/testruns` answers: the finished run, one test failed. */
const RUN_RESULT = `<?xml version="1.0" encoding="utf-8"?><aunit:runResult xmlns:aunit="http://www.sap.com/adt/aunit" xmlns:adtcore="http://www.sap.com/adt/core">
<program adtcore:uri="/sap/bc/adt/oo/classes/zcl_tests" adtcore:name="ZCL_TESTS"><testClasses><testClass adtcore:name="LTC_ADD"><testMethods>
<testMethod adtcore:uri="/sap/bc/adt/oo/classes/zcl_tests/includes/testclasses#adds" adtcore:name="ADDS_TWO"/>
<testMethod adtcore:uri="/sap/bc/adt/oo/classes/zcl_tests/includes/testclasses#fails" adtcore:name="FAILS_ON_PURPOSE"><alerts><alert kind="failedAssertion" severity="critical"><title>Critical Assertion Error: 'Assert Equals'</title></alert></alerts></testMethod>
</testMethods></testClass></testClasses></program></aunit:runResult>`;

/**
 * The body `runSync` sends for one class with no options given, byte for byte:
 * the shared request now also serves reports and function groups, and a class
 * must keep receiving exactly this.
 */
const SYNC_BODY = `<?xml version="1.0" encoding="UTF-8"?><aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
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
        <adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_tests"/>
      </adtcore:objectReferences>
    </objectSet>
  </adtcore:objectSets>
</aunit:runConfiguration>`;

const RUN_STARTED = {
  status: 200,
  headers: { location: '/sap/bc/adt/abapunit/runs/00155D-3F2A' },
  data: '<aunit:run xmlns:aunit="http://www.sap.com/adt/api/aunit"/>',
};

function makeConn(handler?: (call: Call) => Partial<IAdtWireResponse>) {
  const calls: Call[] = [];
  const conn = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (call: Call) => {
      calls.push(call);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
        ...handler?.(call),
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe('ClassTestRunner — running', () => {
  it('named test classes: one POST to /runs, and the id from the header', async () => {
    const { conn, calls } = makeConn(() => RUN_STARTED);
    const runner = new ClassTestRunner(conn, {
      logger: createLibraryLogger(),
      results: {
        ...classTestRunnerDocuments,
        run: unitTestRunId,
      },
    });

    const runId = expectResult(
      await runner.run([{ containerClass: 'ZCL_TESTS', testClass: 'LTCL' }]),
      'start a run',
    );

    expect(runId).toBe('00155D-3F2A');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/runs');
    expect(String(calls[0].data)).toContain('<aunit:tests>');
  });

  it('a class name runs the whole class, by object', async () => {
    const { conn, calls } = makeConn(() => RUN_STARTED);
    const runner = new ClassTestRunner(conn, {
      logger: createLibraryLogger(),
      results: classTestRunnerDocuments,
    });

    await runner.run('zcl_tests');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/runs');
    expect(String(calls[0].data)).toContain(
      '<osl:object name="ZCL_TESTS" type="CLAS"/>',
    );
  });

  it('asking about a run is a separate request, taking the id', async () => {
    const { conn, calls } = makeConn();
    const runner = new ClassTestRunner(conn, {
      logger: createLibraryLogger(),
      results: classTestRunnerDocuments,
    });

    await runner.getStatus('00155D-3F2A', false);
    await runner.getResult('00155D-3F2A');

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET /sap/bc/adt/abapunit/runs/00155D-3F2A',
      'GET /sap/bc/adt/abapunit/results/00155D-3F2A',
    ]);
  });

  it('manages nothing: no create, update, delete or lock', () => {
    const { conn } = makeConn();
    const runner = new ClassTestRunner(conn, {
      logger: createLibraryLogger(),
      results: classTestRunnerDocuments,
    });

    for (const name of ['create', 'read', 'update', 'delete', 'lock']) {
      expect(name in runner).toBe(false);
    }
  });

  it('is what AdtExecutor hands out', () => {
    const { conn } = makeConn();

    expect(new AdtExecutor(conn).getClassTestRunner()).toBeInstanceOf(
      ClassTestRunner,
    );
  });
});

describe('ClassTestRunner — running synchronously (runSync)', () => {
  /** Marks which strategy read the answer. */
  const results = {
    ...classTestRunnerDocuments,
    run: () => 'read by run',
    result: () => 'read by result',
  };

  it('one POST to /testruns, application/xml both ways, read by `result`', async () => {
    const { conn, calls } = makeConn(() => ({ data: RUN_RESULT }));
    const runner = new ClassTestRunner(conn, {
      logger: createLibraryLogger(),
      results,
    });

    const answer = expectResult(await runner.runSync('zcl_tests'), 'runSync');

    expect(answer).toBe('read by result');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/testruns');
    expect(calls[0].headers).toEqual({
      'Content-Type': 'application/xml',
      Accept: 'application/xml',
    });
  });

  it('the run configuration names the class by URI, with the default options', async () => {
    const { conn, calls } = makeConn(() => ({ data: RUN_RESULT }));
    const runner = new ClassTestRunner(conn, {
      logger: createLibraryLogger(),
      results: classTestRunnerDocuments,
    });

    await runner.runSync('zcl_tests');

    const body = String(calls[0].data);
    expect(body).toContain(
      '<aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">',
    );
    expect(body).toContain(
      '<adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_tests"/>',
    );
    expect(body).toContain(
      '<testDeterminationStrategy sameProgram="true" assignedTests="false" appendAssignedTestsPreview="true"/>',
    );
    expect(body).toContain(
      '<testRiskLevels harmless="true" dangerous="true" critical="true"/>',
    );
    expect(body).toContain(
      '<testDurations short="true" medium="true" long="true"/>',
    );
    expect(body).not.toContain('<aunit:run ');
  });

  it('the body is pinned byte for byte', async () => {
    const { conn, calls } = makeConn(() => ({ data: RUN_RESULT }));
    const runner = new ClassTestRunner(conn, {
      logger: createLibraryLogger(),
      results: classTestRunnerDocuments,
    });

    await runner.runSync('ZCL_TESTS');

    expect(calls[0].data).toBe(SYNC_BODY);
  });

  it('scope, risk levels and durations are sent as given', async () => {
    const { conn, calls } = makeConn(() => ({ data: RUN_RESULT }));
    const runner = new ClassTestRunner(conn, {
      logger: createLibraryLogger(),
      results: classTestRunnerDocuments,
    });

    await runner.runSync('ZCL_TESTS', {
      title: 'not in this format',
      scope: { ownTests: false, foreignTests: true },
      riskLevel: { dangerous: false, critical: false },
      duration: { long: false },
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
    expect(body).not.toContain('analyse');
  });

  it('test definitions run each distinct container whole', async () => {
    const { conn, calls } = makeConn(() => ({ data: RUN_RESULT }));
    const runner = new ClassTestRunner(conn, {
      logger: createLibraryLogger(),
      results: classTestRunnerDocuments,
    });

    await runner.runSync([
      { containerClass: 'ZCL_A', testClass: 'LTCL_1' },
      { containerClass: 'ZCL_A', testClass: 'LTCL_2' },
      { containerClass: 'ZCL_B', testClass: 'LTCL_1' },
    ]);

    const refs = [
      ...String(calls[0].data).matchAll(
        /objectReference adtcore:uri="([^"]+)"/g,
      ),
    ].map((m) => m[1]);
    expect(refs).toEqual([
      '/sap/bc/adt/oo/classes/zcl_a',
      '/sap/bc/adt/oo/classes/zcl_b',
    ]);
  });

  it('a failing test is the caller’s analyse to judge, not the runner’s', async () => {
    const { conn } = makeConn(() => ({ data: RUN_RESULT }));
    const runner = new ClassTestRunner(conn, {
      logger: createLibraryLogger(),
      results: classTestRunnerDocuments,
    });

    const asItCame = expectResult(
      await runner.runSync('ZCL_TESTS'),
      'no analyse',
    );
    expect(String(asItCame)).toContain('FAILS_ON_PURPOSE');

    const judged = expectFailure(
      await runner.runSync('ZCL_TESTS', { analyse: analyseUnitTest }),
      'analyseUnitTest',
    );
    expect(judged.message).toContain(
      "Critical Assertion Error: 'Assert Equals'",
    );
  });

  it('AdtExecutor hands it out; the asynchronous `run` stays on /runs', async () => {
    const { conn, calls } = makeConn(() => RUN_STARTED);
    const runner = new AdtExecutor(conn).getClassTestRunner();

    await runner.run('ZCL_TESTS');
    await runner.runSync('ZCL_TESTS');

    expect(calls.map((c) => c.url)).toEqual([
      '/sap/bc/adt/abapunit/runs',
      '/sap/bc/adt/abapunit/testruns',
    ]);
  });
});
