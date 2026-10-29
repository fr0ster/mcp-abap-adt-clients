/**
 * The legacy report, function group and function module runners send the
 * modern `runSync` request — from `run` as well (on 7.40 it is the run) — but
 * not a function module's `run`, which names no group. The fixtures are the
 * root package's `syncTestRunners.test.ts`'s.
 */

import {
  FunctionGroupTestRunner,
  FunctionModuleTestRunner,
  functionGroupTestRunnerDocuments,
  functionModuleTestRunnerDocuments,
  ProgramTestRunner,
  programTestRunnerDocuments,
} from '@mcp-abap-adt/adt-clients';
import { analyseUnitTest } from '@mcp-abap-adt/adt-strategies';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  expectFailure,
  expectResult,
} from '../../../../../adt-clients/src/__tests__/helpers/contract';
import { createLibraryLogger } from '../../../../../adt-clients/src/__tests__/helpers/testLogger';
import { abapUnitRunnerDocuments } from '../../../../../adt-clients/src/executors/abapUnitRunner';
import { FunctionGroupTestRunnerLegacy } from '../../../executors/functionGroup/FunctionGroupTestRunnerLegacy';
import { FunctionModuleTestRunnerLegacy } from '../../../executors/functionModule/FunctionModuleTestRunnerLegacy';
import { ProgramTestRunnerLegacy } from '../../../executors/program/ProgramTestRunnerLegacy';

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

describe('legacy runners send the synchronous request', () => {
  /**
   * Each legacy member beside the modern member whose body it must send, and
   * the strategy that reads its answer. On 7.40 the testruns POST is the run,
   * so `run` sends it too, read by `run`.
   */
  const legacy = [
    {
      label: 'ProgramTestRunnerLegacy.run',
      call: (conn: IAbapConnection, options?: object) =>
        new ProgramTestRunnerLegacy(conn, {
          logger: createLibraryLogger(),
          results: marked,
        }).run('ZR_REPORT', options),
      modern: (conn: IAbapConnection, options?: object) =>
        new ProgramTestRunner(conn, {
          logger: createLibraryLogger(),
          results: programTestRunnerDocuments,
        }).runSync('ZR_REPORT', options),
      uri: '/sap/bc/adt/programs/programs/zr_report',
      readBy: 'read by run',
    },
    {
      label: 'ProgramTestRunnerLegacy.runSync',
      call: (conn: IAbapConnection, options?: object) =>
        new ProgramTestRunnerLegacy(conn, {
          logger: createLibraryLogger(),
          results: marked,
        }).runSync('ZR_REPORT', options),
      modern: (conn: IAbapConnection, options?: object) =>
        new ProgramTestRunner(conn, {
          logger: createLibraryLogger(),
          results: programTestRunnerDocuments,
        }).runSync('ZR_REPORT', options),
      uri: '/sap/bc/adt/programs/programs/zr_report',
      readBy: 'read by result',
    },
    {
      label: 'FunctionGroupTestRunnerLegacy.run',
      call: (conn: IAbapConnection, options?: object) =>
        new FunctionGroupTestRunnerLegacy(conn, {
          logger: createLibraryLogger(),
          results: marked,
        }).run('Z_GROUP', options),
      modern: (conn: IAbapConnection, options?: object) =>
        new FunctionGroupTestRunner(conn, {
          logger: createLibraryLogger(),
          results: functionGroupTestRunnerDocuments,
        }).runSync('Z_GROUP', options),
      uri: '/sap/bc/adt/functions/groups/z_group',
      readBy: 'read by run',
    },
    {
      label: 'FunctionGroupTestRunnerLegacy.runSync',
      call: (conn: IAbapConnection, options?: object) =>
        new FunctionGroupTestRunnerLegacy(conn, {
          logger: createLibraryLogger(),
          results: marked,
        }).runSync('Z_GROUP', options),
      modern: (conn: IAbapConnection, options?: object) =>
        new FunctionGroupTestRunner(conn, {
          logger: createLibraryLogger(),
          results: functionGroupTestRunnerDocuments,
        }).runSync('Z_GROUP', options),
      uri: '/sap/bc/adt/functions/groups/z_group',
      readBy: 'read by result',
    },
    {
      label: 'FunctionModuleTestRunnerLegacy.runSync',
      call: (conn: IAbapConnection, options?: object) =>
        new FunctionModuleTestRunnerLegacy(conn, {
          logger: createLibraryLogger(),
          results: marked,
        }).runSync(
          { functionGroupName: 'Z_GROUP', functionModuleName: 'Z_MODULE' },
          options,
        ),
      modern: (conn: IAbapConnection, options?: object) =>
        new FunctionModuleTestRunner(conn, {
          logger: createLibraryLogger(),
          results: functionModuleTestRunnerDocuments,
        }).runSync(
          { functionGroupName: 'Z_GROUP', functionModuleName: 'Z_MODULE' },
          options,
        ),
      uri: '/sap/bc/adt/functions/groups/z_group/fmodules/z_module',
      readBy: 'read by result',
    },
  ];

  /** The body the modern member sends for the same target and options. */
  async function modernBody(
    modern: (conn: IAbapConnection, options?: object) => Promise<unknown>,
    options?: object,
  ): Promise<unknown> {
    const { conn, calls } = makeConn();
    await modern(conn, options);
    expect(calls).toHaveLength(1);
    return calls[0].data;
  }

  describe.each(legacy)('$label', ({ call, modern, uri, readBy }) => {
    it('one POST to /testruns, application/xml both ways, read by its own strategy', async () => {
      const { conn, calls } = makeConn();

      expect(expectResult(await call(conn), 'legacy run')).toBe(readBy);
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('POST');
      expect(calls[0].url).toBe('/sap/bc/adt/abapunit/testruns');
      expect(calls[0].headers).toEqual({
        'Content-Type': 'application/xml',
        Accept: 'application/xml',
      });
    });

    it('the modern runSync body, byte for byte — <options> though none were given', async () => {
      const { conn, calls } = makeConn();

      await call(conn);

      expect(calls[0].data).toBe(await modernBody(modern));
      expect(calls[0].data).toBe(bodyFor(uri));
    });

    it("a caller's scope, risk levels and durations reach the body", async () => {
      const options = {
        scope: { ownTests: false, foreignTests: true },
        riskLevel: { dangerous: false, critical: false },
        duration: { long: false },
        analyse: analyseUnitTest,
      };
      const { conn, calls } = makeConn();

      await call(conn, options);

      expect(calls[0].data).toBe(await modernBody(modern, options));
      expect(String(calls[0].data)).toContain(
        '<testDeterminationStrategy sameProgram="false" assignedTests="true" appendAssignedTestsPreview="true"/>',
      );
    });
  });

  it("FunctionModuleTestRunnerLegacy.run refuses without a request: it takes no group, and the module's URI lies under it", async () => {
    const { conn, calls } = makeConn();
    const runner = new FunctionModuleTestRunnerLegacy(conn, {
      logger: createLibraryLogger(),
      results: functionModuleTestRunnerDocuments,
    });

    // @ts-expect-error -- 7.40 does not serve this operation; the refusal is for a caller outside the type system
    const refusal = expectFailure(await runner.run(), 'no module run on 7.40');
    expect(refusal.origin).toBe('refusal');
    expect(refusal.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
    expect(refusal.message).toContain('/sap/bc/adt/abapunit/runs');
    expect(refusal.message).toContain(
      'runSync({ functionGroupName, functionModuleName })',
    );
    expect(calls).toHaveLength(0);
  });
});
