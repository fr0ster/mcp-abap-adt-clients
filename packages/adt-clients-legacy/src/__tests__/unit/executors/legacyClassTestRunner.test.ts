/**
 * Running a class's ABAP Unit tests on 7.40: `run` is the synchronous POST to
 * `/testruns`, the modern `runSync` body byte for byte, and there is no run
 * to poll. The fixtures are the root package's `classTestRunner.test.ts`'s.
 */

import {
  ClassTestRunner,
  classTestRunnerDocuments,
} from '@mcp-abap-adt/adt-clients';
import { analyseUnitTest } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  expectFailure,
  expectResult,
} from '../../../../../adt-clients/src/__tests__/helpers/contract';
import { createLibraryLogger } from '../../../../../adt-clients/src/__tests__/helpers/testLogger';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import { ClassTestRunnerLegacy } from '../../../executors/class/ClassTestRunnerLegacy';

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
  it('the legacy executor hands out the legacy one', () => {
    const { conn } = makeConn();

    expect(new AdtExecutorLegacy(conn).getClassTestRunner()).toBeInstanceOf(
      ClassTestRunnerLegacy,
    );
  });
});

describe('ClassTestRunnerLegacy', () => {
  /** Marks which strategy read the answer. */
  const marked = {
    ...classTestRunnerDocuments,
    run: () => 'read by run',
    result: () => 'read by result',
  };

  /** The body the modern `runSync` sends for the same target and options. */
  async function modernBody(
    target: Parameters<ClassTestRunner['runSync']>[0],
    options?: Parameters<ClassTestRunner['runSync']>[1],
  ): Promise<unknown> {
    const { conn, calls } = makeConn(() => ({ data: RUN_RESULT }));
    await new ClassTestRunner(conn, createLibraryLogger()).runSync(
      target,
      options,
    );
    expect(calls).toHaveLength(1);
    return calls[0].data;
  }

  it.each([
    ['run', 'read by run'],
    ['runSync', 'read by result'],
  ] as const)(
    '%s: one POST to /testruns, the modern runSync body byte for byte, read by %s',
    async (member, readBy) => {
      const { conn, calls } = makeConn(() => ({ data: RUN_RESULT }));
      const runner = new ClassTestRunnerLegacy(
        conn,
        createLibraryLogger(),
        marked,
      );

      expect(expectResult(await runner[member]('ZCL_TESTS'), member)).toBe(
        readBy,
      );
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('POST');
      expect(calls[0].url).toBe('/sap/bc/adt/abapunit/testruns');
      expect(calls[0].headers).toEqual({
        'Content-Type': 'application/xml',
        Accept: 'application/xml',
      });
      expect(calls[0].data).toBe(SYNC_BODY);
      expect(calls[0].data).toBe(await modernBody('ZCL_TESTS'));
    },
  );

  it.each(['run', 'runSync'] as const)(
    "%s: a caller's scope, risk levels and durations reach the body",
    async (member) => {
      const options = {
        scope: { ownTests: false, foreignTests: true },
        riskLevel: { dangerous: false },
        duration: { long: false },
        analyse: analyseUnitTest,
      };
      const { conn, calls } = makeConn(() => ({ data: RUN_RESULT }));
      const runner = new ClassTestRunnerLegacy(conn, createLibraryLogger());

      await runner[member]('ZCL_TESTS', options);

      const body = String(calls[0].data);
      expect(body).toContain(
        '<testDeterminationStrategy sameProgram="false" assignedTests="true" appendAssignedTestsPreview="true"/>',
      );
      expect(body).toContain(
        '<testRiskLevels harmless="true" dangerous="false" critical="true"/>',
      );
      expect(body).toContain(
        '<testDurations short="true" medium="true" long="false"/>',
      );
      expect(calls[0].data).toBe(await modernBody('ZCL_TESTS', options));
    },
  );

  it('runs each distinct container whole, on /testruns', async () => {
    const { conn, calls } = makeConn();
    const runner = new ClassTestRunnerLegacy(conn, createLibraryLogger());

    await runner.run([
      { containerClass: 'ZCL_TESTS', testClass: 'LTCL_A' },
      { containerClass: 'ZCL_TESTS', testClass: 'LTCL_B' },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/sap/bc/adt/abapunit/testruns');
    const body = String(calls[0].data);
    expect(body.match(/objectReference /g)).toHaveLength(1);
    expect(body).toContain('/sap/bc/adt/oo/classes/zcl_tests');
  });

  it('refuses to poll or fetch without a request: the POST answered the result', async () => {
    const { conn, calls } = makeConn();
    const runner = new ClassTestRunnerLegacy(conn, createLibraryLogger());

    // @ts-expect-error -- 7.40 does not serve this operation; the refusal is for a caller outside the type system
    expectFailure(await runner.getStatus(), 'no run to poll');
    // @ts-expect-error -- 7.40 does not serve this operation; the refusal is for a caller outside the type system
    expectFailure(await runner.getResult(), 'no result to fetch');
    expect(calls).toHaveLength(0);
  });
});
